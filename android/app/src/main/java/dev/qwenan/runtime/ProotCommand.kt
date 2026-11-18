package dev.qwenan.runtime

import java.io.File

/** Rutas del entorno de proot en el teléfono. */
data class ProotConfig(
    /** libproot.so extraído de jniLibs (nativeLibraryDir). */
    val prootBinary: File,
    /** Directorio raíz de la distro ya extraída. */
    val rootfsDir: File,
    /** Carpeta del workspace elegida con SAF (ya copiada/accesible como ruta). Se monta en /workspace. */
    val workspaceDir: File? = null,
    /** Directorio temporal escribible de la app (PROOT_TMP_DIR). */
    val tmpDir: File,
    val home: String = "/root",
)

/** Comando listo para ProcessBuilder: argumentos, entorno y directorio de trabajo. */
data class ProotLaunch(val args: List<String>, val env: Map<String, String>, val workDir: File)

/**
 * Construye la línea de proot. Sin shell: los argumentos van como lista, así que las rutas con
 * espacios no necesitan escapes. En Android se desactiva el sandbox del kernel (no está
 * disponible dentro de proot) y se usa fake root (-0) para que apt funcione.
 */
object ProotCommand {
    const val WORKSPACE_GUEST = "/workspace"
    private const val PATH = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

    fun build(config: ProotConfig, command: List<String>): ProotLaunch {
        require(command.isNotEmpty()) { "el comando no puede estar vacío" }
        val args = mutableListOf(
            config.prootBinary.path,
            "-r", config.rootfsDir.path,
            "-0",
            "--link2symlink",
            "--kill-on-exit",
            "-b", "/dev",
            "-b", "/proc",
            "-b", "/sys",
        )
        config.workspaceDir?.let { args += listOf("-b", "${it.path}:$WORKSPACE_GUEST") }
        args += listOf("-w", if (config.workspaceDir != null) WORKSPACE_GUEST else config.home)
        args += listOf(
            "/usr/bin/env", "-i",
            "HOME=${config.home}",
            "PATH=$PATH",
            "LANG=C.UTF-8",
            "TERM=xterm-256color",
        )
        args += command

        val env = mapOf(
            "PROOT_TMP_DIR" to config.tmpDir.path,
            // Sin sandbox del kernel: bwrap y Landlock no funcionan dentro de proot (ver android/PLAN.md).
            "QWENAN_SANDBOX" to "off",
        )
        return ProotLaunch(args, env, config.tmpDir)
    }
}
