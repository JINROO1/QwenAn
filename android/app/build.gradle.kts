plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "dev.qwenan"
    compileSdk = 34

    defaultConfig {
        applicationId = "dev.qwenan"
        minSdk = 29 // Android 10, según el plan
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("com.github.luben:zstd-jni:1.5.6-3")
    implementation("org.apache.commons:commons-compress:1.26.2")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303") // org.json del SDK de Android no funciona en JVM
}
