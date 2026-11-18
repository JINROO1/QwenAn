import java.security.MessageDigest

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// libproot.so se descarga de la release runtime-v1 antes de compilar y se verifica por SHA-256.
// Así no hay binarios en Git. El valor corresponde al artefacto de .github/workflows/android-proot.yml.
val prootUrl = "https://github.com/JINROO1/QwenAn/releases/download/runtime-v1/libproot.so"
val prootSha256 = "9a4f9da7f7a5465d6536ba67e6686eaebaeb7042808d47acdebc744a9c9c9071"
val prootOut = file("src/main/jniLibs/arm64-v8a/libproot.so")

val fetchProot by tasks.registering {
    outputs.file(prootOut)
    doLast {
        if (!prootOut.exists() || sha256(prootOut) != prootSha256) {
            prootOut.parentFile.mkdirs()
            uri(prootUrl).toURL().openStream().use { input ->
                prootOut.outputStream().use { input.copyTo(it) }
            }
        }
        val got = sha256(prootOut)
        check(got == prootSha256) { "libproot.so con SHA-256 $got, se esperaba $prootSha256" }
    }
}

fun sha256(f: File): String =
    MessageDigest.getInstance("SHA-256").digest(f.readBytes()).joinToString("") { "%02x".format(it) }

android {
    namespace = "dev.qwenan"
    compileSdk = 34

    defaultConfig {
        applicationId = "dev.qwenan"
        minSdk = 29 // Android 10, según el plan
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0"
        ndk {
            abiFilters += "arm64-v8a"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    packaging {
        // proot y los binarios deben quedar extraídos en nativeLibraryDir para poder ejecutarse.
        jniLibs {
            useLegacyPackaging = true
        }
    }
}

tasks.named("preBuild") {
    dependsOn(fetchProot)
}

dependencies {
    implementation("com.github.luben:zstd-jni:1.5.6-3")
    implementation("org.apache.commons:commons-compress:1.26.2")
    implementation("androidx.webkit:webkit:1.11.0")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303") // org.json del SDK de Android no funciona en JVM
}
