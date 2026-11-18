package dev.qwenan.runtime

import org.json.JSONArray
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File
import java.io.IOException
import java.nio.file.Files

class RuntimeInstallerTest {
    private lateinit var server: MiniServer
    private lateinit var base: String
    private val served = mutableMapOf<String, ByteArray>()
    private val requested = mutableListOf<String>()
    private val fileA = ByteArray(250_000) { (it * 7 % 251).toByte() }
    private val fileB = ByteArray(90_000) { (it * 13 % 241).toByte() }

    @Before
    fun setUp() {
        val chunkSize = 100_000
        fun chunksOf(name: String, data: ByteArray): List<Pair<String, ByteArray>> =
            data.toList().chunked(chunkSize).mapIndexed { i, l ->
                "$name.part-%03d".format(i) to l.toByteArray()
            }
        val a = chunksOf("a.bin", fileA)
        val b = chunksOf("b.bin", fileB)
        (a + b).forEach { (n, bytes) -> served["/$n"] = bytes }
        server = MiniServer { path, range ->
            synchronized(requested) { requested += path }
            val body = served[path] ?: return@MiniServer MiniServer.Reply(404)
            if (range != null && range.startsWith("bytes=")) {
                val start = range.removePrefix("bytes=").removeSuffix("-").toInt()
                MiniServer.Reply(206, mapOf("Content-Range" to "bytes $start-${body.size - 1}/${body.size}"), body.copyOfRange(start, body.size))
            } else {
                MiniServer.Reply(200, body = body)
            }
        }
        base = "http://127.0.0.1:${server.port}"
    }

    @After
    fun tearDown() {
        server.close()
    }

    private fun manifest(
        assets: List<Triple<String, ByteArray, String>>,
        finalShaOverride: String? = null,
    ): String {
        val arr = JSONArray()
        for ((name, data, _) in assets) {
            val chunks = JSONArray()
            data.toList().chunked(100_000).forEachIndexed { i, l ->
                val bytes = l.toByteArray()
                chunks.put(JSONObject().apply {
                    put("name", "$name.part-%03d".format(i))
                    put("size", bytes.size)
                    put("sha256", RuntimeDownloader.sha256(tmpFile(bytes)))
                })
            }
            arr.put(JSONObject().apply {
                put("file", name)
                put("size", data.size)
                put("sha256", finalShaOverride ?: RuntimeDownloader.sha256(tmpFile(data)))
                put("chunks", chunks)
            })
        }
        return JSONObject().apply { put("assets", arr) }.toString()
    }

    private fun tmpFile(bytes: ByteArray): File {
        val f = File.createTempFile("payload", ".bin")
        f.writeBytes(bytes)
        return f
    }

    private fun newDir(): File = Files.createTempDirectory("rt").toFile()

    private fun assets() = listOf(
        Triple("a.bin", fileA, ""),
        Triple("b.bin", fileB, ""),
    )

    @Test
    fun installsAllAssetsAndVerifies() {
        val dir = newDir()
        val installed = RuntimeInstaller(base, dir, sleep = {}).install(manifest(assets()))
        assertEquals(setOf("a.bin", "b.bin"), installed.keys)
        assertTrue(fileA.contentEquals(File(dir, "a.bin").readBytes()))
        assertTrue(fileB.contentEquals(File(dir, "b.bin").readBytes()))
        assertFalse(File(dir, "parts").exists())
    }

    @Test
    fun secondInstallDoesNotRedownload() {
        val dir = newDir()
        val json = manifest(assets())
        RuntimeInstaller(base, dir, sleep = {}).install(json)
        requested.clear()
        val messages = mutableListOf<String>()
        RuntimeInstaller(base, dir, sleep = {}).install(json) { messages += it }
        assertTrue(requested.isEmpty())
        assertEquals(2, messages.count { it.startsWith("ya instalado") })
    }

    @Test
    fun reinstallsWhenInstalledFileIsCorrupt() {
        val dir = newDir()
        val json = manifest(assets())
        RuntimeInstaller(base, dir, sleep = {}).install(json)
        File(dir, "a.bin").writeBytes(ByteArray(fileA.size) { 1 })
        RuntimeInstaller(base, dir, sleep = {}).install(json)
        assertTrue(fileA.contentEquals(File(dir, "a.bin").readBytes()))
    }

    @Test
    fun failsWhenFinalShaDoesNotMatch() {
        val dir = newDir()
        val json = manifest(assets(), finalShaOverride = "0".repeat(64))
        val e = assertThrows(IOException::class.java) {
            RuntimeInstaller(base, dir, maxAttempts = 2, sleep = {}).install(json)
        }
        assertTrue(e.message!!.contains("a.bin"))
        assertFalse(File(dir, "a.bin").exists())
    }
}
