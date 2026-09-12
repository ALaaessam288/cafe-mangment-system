package com.example.cafemangmentsystem.security;

import com.example.cafemangmentsystem.security.jwt.JwtAuthenticationFilter;
import com.example.cafemangmentsystem.tenant.platform.PlatformApiKeyFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityCustomizer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.net.URI;
import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final PlatformApiKeyFilter platformApiKeyFilter;
    private final RestAuthenticationEntryPoint restAuthenticationEntryPoint;
    private final RestAccessDeniedHandler restAccessDeniedHandler;
    private final SubscriptionGuardFilter subscriptionGuardFilter;

    @Value("${cors.allowed-origins:http://localhost:5173,http://127.0.0.1:5173}")
    private String allowedOriginsString;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers("/", "/index.html", "/favicon.ico", "/assets/**", "/*.png", "/*.jpg", "/*.jpeg", "/*.svg", "/*.ico", "/*.css", "/*.js", "/*.woff", "/*.woff2", "/*.ttf").permitAll()
                .requestMatchers("/error").permitAll()
                .requestMatchers("/api/health").permitAll()
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/api/platform/**").permitAll()
                .requestMatchers("/api/license/validate").permitAll()
                // The pricing catalogue is public: the signup and onboarding screens render it
                // before anyone has an account, and a price list is public information anyway.
                // Only the read side — /api/admin/plans still requires SUPER_ADMIN.
                .requestMatchers(HttpMethod.GET, "/api/plans", "/api/plans/features").permitAll()
                .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                .requestMatchers("/api/**").authenticated()
                .anyRequest().permitAll()
            )
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(restAuthenticationEntryPoint)
                .accessDeniedHandler(restAccessDeniedHandler))
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterAfter(platformApiKeyFilter, JwtAuthenticationFilter.class)
            .addFilterAfter(subscriptionGuardFilter, PlatformApiKeyFilter.class);

        return http.build();
    }

    @Bean
    public WebSecurityCustomizer webSecurityCustomizer() {
        return web -> web.ignoring()
            .requestMatchers(
                "/assets/**",
                "/favicon.ico",
                "/*.png", "/*.jpg", "/*.jpeg", "/*.svg", "/*.ico",
                "/*.css", "/*.js",
                "/*.woff", "/*.woff2", "/*.ttf"
            );
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        List<String> origins = Arrays.stream(allowedOriginsString.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
        
        config.setAllowedOrigins(origins);
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(Arrays.asList("*"));
        config.setExposedHeaders(Arrays.asList("Authorization"));
        config.setAllowCredentials(true);
        
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);

        // This application serves its own frontend, so the browser attaches an Origin header equal
        // to the app's own address on every POST/PUT/DELETE - even though nothing cross-origin is
        // happening. Spring validates that header against the allow-list regardless, so a
        // deployment whose own address was not listed rejected its own login form with
        // "403 Invalid CORS request". That response carries no Access-Control-Allow-Origin, so the
        // browser hides it from JavaScript and reports a bare network error: the UI said "cannot
        // reach the server" while the server was up and answering /api/health in 117 ms.
        // Returning null for a same-origin request tells Spring there is no CORS decision to make.
        return request -> isSameOrigin(request) ? null : source.getCorsConfiguration(request);
    }

    /**
     * True when the request carries no Origin (not a CORS request at all) or carries one naming
     * this very host. Behind a reverse proxy - Railway, nginx - the Host header holds the internal
     * address, so the forwarded host is preferred when present.
     */
    private static boolean isSameOrigin(HttpServletRequest request) {
        String origin = request.getHeader(HttpHeaders.ORIGIN);
        if (origin == null || origin.isBlank()) {
            return true;
        }

        String originAuthority;
        try {
            originAuthority = URI.create(origin).getAuthority();
        } catch (IllegalArgumentException malformedOrigin) {
            return false;
        }
        if (originAuthority == null) {
            return false;
        }

        String forwardedHost = request.getHeader("X-Forwarded-Host");
        String host = (forwardedHost != null && !forwardedHost.isBlank())
                ? forwardedHost.split(",")[0].trim()
                : request.getHeader(HttpHeaders.HOST);

        return originAuthority.equalsIgnoreCase(host);
    }
}
