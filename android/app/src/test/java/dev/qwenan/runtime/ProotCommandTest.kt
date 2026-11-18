package dev.qwenan.runtime

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class ProotCommandTest {
    private val cfg = ProotConfig(
        prootBinary = File("/data/app/lib/arm64/libproot.so"),
        rootfsDir = File("/data/data/dev.qwenan/files/rootfs"),
        workspaceDir = File("/storage/emulated/0/Projects con espacio"),
        tmpDir = File("/data/data/dev.qwenan/cache/proot"),
    )

    @Test
    fun buildsArgsWithRootfsAndWorkspaceBind() {
        val l = ProotCommand.build(cfg, listOf("/usr/bin/node", "qwen", "serve"))
        assertEquals("/data/app/lib/arm64/libproot.so", l.args[0])
        val r = l.args.indexOf("-r")
        assertEquals("/data/data/dev.qwenan/files/rootfs", l.args[r + 1])
        assertTrue(l.args.contains("-0"))
        // La ruta con espacios va como un solo argumento, sin escapes.
        assertTrue(l.args.contains("/storage/emulated/0/Projects con espacio:/workspace"))
        val w = l.args.indexOf("-w")
        assertEquals("/workspace", l.args[w + 1])
    }

    @Test
    fun commandIsAtTheEnd() {
        val l = ProotCommand.build(cfg, listOf("/usr/bin/node", "qwen", "serve", "--port", "4170"))
        assertEquals(listOf("/usr/bin/node", "qwen", "serve", "--port", "4170"), l.args.takeLast(5))
    }

    @Test
    fun withoutWorkspaceStartsInHome() {
        val l = ProotCommand.build(cfg.copy(workspaceDir = null), listOf("/bin/sh"))
        assertFalse(l.args.any { it.endsWith(":/workspace") })
        val w = l.args.indexOf("-w")
        assertEquals("/root", l.args[w + 1])
    }

    @Test
    fun setsTmpDir() {
        val l = ProotCommand.build(cfg, listOf("/bin/true"))
        assertEquals("/data/data/dev.qwenan/cache/proot", l.env["PROOT_TMP_DIR"])
        assertEquals(cfg.tmpDir, l.workDir)
    }

    @Test(expected = IllegalArgumentException::class)
    fun rejectsEmptyCommand() {
        ProotCommand.build(cfg, emptyList())
    }
}
