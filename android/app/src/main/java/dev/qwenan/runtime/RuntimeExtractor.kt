package dev.qwenan.runtime

import com.github.luben.zstd.ZstdInputStream
import org.apache.commons.compress.archivers.tar.TarArchiveEntry
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import java.io.BufferedInputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException
import java.nio.file.Files
import java.nio.file.Paths

/**
 * Extrae un .tar.zst en un directorio. Rechaza rutas que salen del destino (path traversal),
 * crea enlaces simbólicos y respeta el bit de ejecución de los binarios.
 */
object RuntimeExtractor {
    fun extract(archive: File, destDir: File) {
        destDir.mkdirs()
        val root = destDir.canonicalFile
        FileInputStream(archive).use { fin ->
            ZstdInputStream(BufferedInputStream(fin)).use { zin ->
                TarArchiveInputStream(zin).use { tar ->
                    while (true) {
                        val entry = tar.nextEntry ?: break
                        val out = resolveSafe(root, entry.name)
                        when {
                            entry.isDirectory -> out.mkdirs()
                            entry.isSymbolicLink -> {
                                out.parentFile.mkdirs()
                                out.delete()
                                Files.createSymbolicLink(out.toPath(), Paths.get(entry.linkName))
                            }
                            entry.isLink -> {
                                // Enlace duro: el destino debe existir dentro del mismo árbol.
                                val target = resolveSafe(root, entry.linkName)
                                out.parentFile.mkdirs()
                                out.delete()
                                Files.createLink(out.toPath(), target.toPath())
                            }
                            entry.isFile -> {
                                out.parentFile.mkdirs()
                                FileOutputStream(out).use { tar.copyTo(it, 1 shl 16) }
                                val executable = entry.mode and 0b001_001_001 != 0
                                out.setExecutable(executable, false)
                                out.setReadable(true, false)
                                out.setWritable(true, true)
                            }
                            entry.isCharacterDevice || entry.isBlockDevice || entry.isFIFO -> {
                                // Nodos de dispositivo y FIFOs no sirven fuera de un sistema real: se omiten.
                            }
                            else -> throw IOException("tipo de entrada no soportado: ${entry.name}")
                        }
                    }
                }
            }
        }
    }

    /** Resuelve una entrada dentro de root; rechaza cualquier ruta que salga de él. */
    internal fun resolveSafe(root: File, name: String): File {
        if (name.startsWith("/") || name.contains("\u0000")) throw IOException("ruta absoluta: $name")
        val target = File(root, name).canonicalFile
        val prefix = root.path + File.separator
        if (target.path != root.path && !target.path.startsWith(prefix)) {
            throw IOException("ruta fuera del destino: $name")
        }
        return target
    }
}
