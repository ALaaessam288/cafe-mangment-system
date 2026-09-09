import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import java.util.stream.*;

/**
 * A deliberately small JUnit 5 runner.
 *
 * <p>Not a replacement for surefire - it exists because this environment cannot reach Maven Central
 * and junit-platform-launcher is not published as a GitHub release asset, so there is no way to run
 * the suite the normal way here. It honours @Test, @BeforeEach, @AfterEach, @BeforeAll, @AfterAll,
 * @Disabled and expected-exception assertions (which live in the assertion library, not the runner),
 * which is everything this suite actually uses. CI should still run `mvn test`.
 */
public class TinyRunner {

    public static void main(String[] args) throws Exception {
        Path root = Paths.get(args[0]);
        List<String> classNames;
        try (var walk = Files.walk(root)) {
            classNames = walk.filter(p -> p.toString().endsWith("Test.class") || p.toString().endsWith("Tests.class"))
                    .map(p -> root.relativize(p).toString()
                            .replace(java.io.File.separatorChar, '.')
                            .replaceAll("\\.class$", ""))
                    .filter(n -> !n.contains("$"))
                    .sorted().collect(Collectors.toList());
        }

        int pass = 0, fail = 0, skip = 0;
        List<String> failures = new ArrayList<>();

        for (String cn : classNames) {
            Class<?> c;
            try { c = Class.forName(cn); } catch (Throwable t) { continue; }
            if (Modifier.isAbstract(c.getModifiers())) continue;

            // A @SpringBootTest needs a container this runner does not start; report it honestly
            // rather than pretending it passed.
            boolean springy = Arrays.stream(c.getAnnotations())
                    .anyMatch(a -> a.annotationType().getName().contains("SpringBootTest"));

            List<Method> tests = methodsWith(c, "org.junit.jupiter.api.Test");
            if (tests.isEmpty()) continue;

            if (springy) {
                skip += tests.size();
                System.out.printf("SKIP  %s (%d tests - needs a Spring context)%n", cn, tests.size());
                continue;
            }

            boolean usesMockito = Arrays.stream(c.getAnnotations())
                    .anyMatch(a -> a.toString().contains("Mockito"))
                    || Arrays.stream(c.getDeclaredFields()).anyMatch(f ->
                            Arrays.stream(f.getAnnotations()).anyMatch(a ->
                                    a.annotationType().getName().startsWith("org.mockito.")));

            List<Method> beforeAll = methodsWith(c, "org.junit.jupiter.api.BeforeAll");
            List<Method> afterAll  = methodsWith(c, "org.junit.jupiter.api.AfterAll");
            List<Method> before    = methodsWith(c, "org.junit.jupiter.api.BeforeEach");
            List<Method> after     = methodsWith(c, "org.junit.jupiter.api.AfterEach");

            for (Method m : beforeAll) { m.setAccessible(true); m.invoke(null); }

            for (Method t : tests) {
                if (hasAnn(t, "org.junit.jupiter.api.Disabled")) {
                    skip++; System.out.printf("SKIP  %s.%s%n", c.getSimpleName(), t.getName()); continue;
                }
                java.lang.reflect.Constructor<?> ctor = c.getDeclaredConstructor();
                ctor.setAccessible(true);
                Object inst = ctor.newInstance();
                Throwable err = null;
                AutoCloseable mocks = null;
                try {
                    // These classes declare @Mock / @InjectMocks and rely on MockitoExtension to
                    // populate them. Without this the fields stay null and every test NPEs.
                    if (usesMockito) {
                        mocks = (AutoCloseable) Class.forName("org.mockito.MockitoAnnotations")
                                .getMethod("openMocks", Object.class).invoke(null, inst);
                    }
                    for (Method b : before) { b.setAccessible(true); b.invoke(inst); }
                    t.setAccessible(true);
                    t.invoke(inst);
                } catch (InvocationTargetException e) {
                    err = e.getTargetException();
                } catch (Throwable e) {
                    err = e;
                } finally {
                    for (Method a : after) {
                        try { a.setAccessible(true); a.invoke(inst); } catch (Throwable ignored) {}
                    }
                    if (mocks != null) { try { mocks.close(); } catch (Throwable ignored) {} }
                }
                if (err == null) {
                    pass++;
                    System.out.printf("ok    %s.%s%n", c.getSimpleName(), t.getName());
                } else {
                    fail++;
                    String line = c.getSimpleName() + "." + t.getName() + "  ->  " + err;
                    failures.add(line);
                    System.out.printf("FAIL  %s%n", line);
                    StackTraceElement[] st = err.getStackTrace();
                    for (int i = 0; i < Math.min(3, st.length); i++) System.out.println("        at " + st[i]);
                }
            }

            for (Method m : afterAll) { m.setAccessible(true); m.invoke(null); }
        }

        System.out.println("\n────────────────────────────────────────");
        System.out.printf("passed %d   failed %d   skipped %d%n", pass, fail, skip);
        if (!failures.isEmpty()) {
            System.out.println("\nFailures:");
            failures.forEach(f -> System.out.println("  - " + f));
        }
        System.exit(fail == 0 ? 0 : 1);
    }

    private static boolean hasAnn(Method m, String fqn) {
        return Arrays.stream(m.getAnnotations()).anyMatch(a -> a.annotationType().getName().equals(fqn));
    }

    private static List<Method> methodsWith(Class<?> c, String fqn) {
        List<Method> out = new ArrayList<>();
        for (Class<?> k = c; k != null && k != Object.class; k = k.getSuperclass()) {
            for (Method m : k.getDeclaredMethods()) if (hasAnn(m, fqn)) out.add(m);
        }
        out.sort(Comparator.comparing(Method::getName));
        return out;
    }
}
