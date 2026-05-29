package pl.jakubmikolajczyk.savings

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

/**
 * Main Spring Boot entry point.
 *
 * KOTLIN vs JAVA:
 * In Java you normally write:
 *
 *     public static void main(String[] args) {
 *         SpringApplication.run(SavingsApplication.class, args);
 *     }
 *
 * Kotlin has top-level functions, so `main` does not need to live inside a class.
 * That is not "magic"; the Kotlin compiler generates a JVM class behind the scenes.
 *
 * INTERVIEW Q: "What does @SpringBootApplication include?"
 * A: It is a composed annotation:
 *    - @SpringBootConfiguration: this class provides app configuration.
 *    - @EnableAutoConfiguration: Spring Boot guesses beans from classpath dependencies.
 *    - @ComponentScan: Spring scans this package and subpackages for @Service, @RestController, etc.
 *
 * INTERVIEW Q: "Why is the package name important in Spring Boot?"
 * A: Component scanning starts from this package. Because this class is in
 *    `pl.jakubmikolajczyk.savings`, classes below that package are found automatically.
 *    If you put controllers in a sibling package, Spring may not discover them.
 */
@SpringBootApplication
class SavingsApplication

fun main(args: Array<String>) {
    /*
     * `runApplication<SavingsApplication>(*args)` is Kotlin's Spring Boot helper.
     *
     * KOTLIN: `<SavingsApplication>` is a generic type argument.
     * KOTLIN: `*args` is the spread operator. It expands Array<String> into varargs.
     *
     * JAVA comparison:
     * `SpringApplication.run(SavingsApplication.class, args)` passes a Class object explicitly.
     * Kotlin can use a reified generic helper, so the call reads shorter.
     */
    runApplication<SavingsApplication>(*args)
}
