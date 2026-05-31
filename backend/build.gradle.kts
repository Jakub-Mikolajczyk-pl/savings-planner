plugins {
    /*
     * Gradle Kotlin DSL:
     * This file is Kotlin code, not Groovy/XML. The upside is typed configuration and IDE help.
     *
     * INTERVIEW Q: "What does kotlin('plugin.spring') do?"
     * A: Kotlin classes are final by default, but Spring often needs proxies/subclasses.
     *    The Spring Kotlin plugin automatically makes Spring-annotated classes open.
     *
     * INTERVIEW Q: "What does kotlin('plugin.jpa') do?"
     * A: JPA needs no-arg constructors for entities. The plugin generates them for classes
     *    annotated with JPA annotations.
     */
    kotlin("jvm") version "2.1.21"
    kotlin("plugin.spring") version "2.1.21"
    kotlin("plugin.jpa") version "2.1.21"
    id("org.springframework.boot") version "3.5.0"
    id("io.spring.dependency-management") version "1.1.7"
}

group = "pl.jakubmikolajczyk"
version = "0.1.0"

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_21)
        freeCompilerArgs.add("-Xjsr305=strict")
    }
}

dependencies {
    /*
     * Dependency groups:
     * - implementation: needed to compile/run app code.
     * - runtimeOnly: not needed at compile time, but needed at runtime.
     * - testImplementation: only for tests.
     *
     * JAVA/Maven comparison:
     * implementation ~= compile/runtime dependency,
     * testImplementation ~= test scope.
     */
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
    implementation("com.fasterxml.jackson.datatype:jackson-datatype-jsr310")
    implementation("org.flywaydb:flyway-core")
    implementation("org.flywaydb:flyway-database-postgresql")
    implementation("org.apache.pdfbox:pdfbox:3.0.4")
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:2.8.8")
    runtimeOnly("org.postgresql:postgresql")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.security:spring-security-test")
    testImplementation("io.mockk:mockk:1.14.2")
    testImplementation("org.testcontainers:junit-jupiter")
    testImplementation("org.testcontainers:postgresql")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.withType<Test> {
    useJUnitPlatform()
}
