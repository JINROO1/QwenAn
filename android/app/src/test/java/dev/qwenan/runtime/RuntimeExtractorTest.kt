package dev.qwenan.runtime

import com.github.luben.zstd.ZstdOutputStream
import org.apache.commons.compress.archivers.tar.TarArchiveEntry
import org.apache.commons.compress.archivers.tar.TarArchiveOutputStream
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.nio.file.Files

class RuntimeExtractorTest {
    private fun makeArchive(build: (TarArchiveOutputStream) -> Unit): File {
        val f = File.createTempFile("runtime", ".tar.zst")
        ZstdOutputStream(FileOutputStream(f)).use { zout ->
            TarArchiveOutputStream(zout).use { tar ->
                tar.setLongFileMode(TarArchiveOutputStream.LONGFILE_POSIX)
                build(tar)
            }
        }
        return f
    }

    private fun TarArchiveOutputStream.file(name: String, data: ByteArray, mode: Int) {
        val e = TarArchiveEntry(name)
        e.size = data.size.toLong()
        e.mode = mode
        putArchiveEntry(e)
        write(data)
        closeArchiveEntry()
    }

    private fun TarArchiveOutputStream.link(name: String, target: String) {
        val e = TarArchiveEntry(name, TarArchiveEntry.LF_SYMLINK)
        e.linkName = target
        putArchiveEntry(e)
        closeArchiveEntry()
    }

    @Test
    fun extractsFilesLinksAndExecutableBit() {
        val archive = makeArchive { tar ->
            tar.file("bin/node", "ELF".toByteArray(), 0x1ed) // 0755
            tar.file("etc/conf.txt", "hola".toByteArray(), 0x1a4) // 0644
            tar.link("bin/node-link", "node")
        }
        val dest = Files.createTempDirectory("ext").toFile()
        RuntimeExtractor.extract(archive, dest)
        assertEquals("ELF", File(dest, "bin/node").readText())
        assertTrue(File(dest, "bin/node").canExecute())
        assertTrue(!File(dest, "etc/conf.txt").canExecute())
        assertEquals("hola", File(dest, "etc/conf.txt").readText())
        assertEquals("node", Files.readSymbolicLink(File(dest, "bin/node-link").toPath()).toString())
    }

    @Test
    fun extractsHardLinks() {
        val archive = makeArchive { tar ->
            tar.file("usr/bin/tool", "T".toByteArray(), 0x1ed)
            val e = TarArchiveEntry("usr/bin/tool2", TarArchiveEntry.LF_LINK)
            e.linkName = "usr/bin/tool"
            tar.putArchiveEntry(e)
            tar.closeArchiveEntry()
        }
        val dest = Files.createTempDirectory("ext").toFile()
        RuntimeExtractor.extract(archive, dest)
        assertEquals("T", File(dest, "usr/bin/tool2").readText())
    }

    @Test
    fun rejectsPathTraversal() {
        val archive = makeArchive { tar -> tar.file("../escape.txt", "x".toByteArray(), 0x1a4) }
        val dest = Files.createTempDirectory("ext").toFile()
        val e = assertThrows(IOException::class.java) { RuntimeExtractor.extract(archive, dest) }
        assertTrue(e.message!!.contains("fuera del destino"))
        assertTrue(!File(dest.parentFile, "escape.txt").exists())
    }

    @Test
    fun absolutePathStaysInsideDestination() {
        // commons-compress quita la "/" inicial al leer la entrada; la ruta resultante queda dentro.
        val archive = makeArchive { tar -> tar.file("/etc/evil", "x".toByteArray(), 0x1a4) }
        val dest = Files.createTempDirectory("ext").toFile()
        RuntimeExtractor.extract(archive, dest)
        assertTrue(File(dest, "etc/evil").exists())
        assertTrue(!File("/etc/evil").exists() || File("/etc/evil").lastModified() < System.currentTimeMillis() - 60_000)
    }
}
