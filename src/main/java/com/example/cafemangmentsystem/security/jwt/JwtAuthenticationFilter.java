package com.example.cafemangmentsystem.security.jwt;

import com.example.cafemangmentsystem.common.tenant.TenantContext;
import com.example.cafemangmentsystem.security.CustomUserDetailsService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtService jwtService;
    private final CustomUserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                     @NonNull HttpServletResponse response,
                                     @NonNull FilterChain filterChain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");

        if (header == null || !header.startsWith(BEARER_PREFIX)) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = header.substring(BEARER_PREFIX.length());
        String username;
        try {
            username = jwtService.extractUsername(token);
        } catch (io.jsonwebtoken.JwtException | IllegalArgumentException e) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                try {
                    // Validate before trusting anything else in the token. The tenant used to be
                    // pushed into TenantContext first, and the chain continued even when
                    // validation then failed - so a request could run against a tenant chosen by
                    // whoever supplied the token, on any path that does not itself require
                    // authentication.
                    if (!jwtService.isTokenValid(token, username)) {
                        filterChain.doFilter(request, response);
                        return;
                    }

                    TenantContext.set(jwtService.extractTenantId(token));
                    UserDetails userDetails = userDetailsService.loadUserByUsername(username);

                    if (userDetails.getUsername().equals(username) && userDetails.isEnabled()) {
                        var authToken = new UsernamePasswordAuthenticationToken(
                                userDetails, null, userDetails.getAuthorities());
                        authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                        SecurityContextHolder.getContext().setAuthentication(authToken);
                    } else {
                        // Token was well formed but the account is gone or disabled. Drop the
                        // tenant again so the unauthenticated request that follows does not
                        // inherit it.
                        TenantContext.clear();
                    }
                } catch (Exception e) {
                    // Expired user, missing account, or a database problem. Proceeding
                    // unauthenticated is the right behaviour, but silently swallowing this made a
                    // genuine outage indistinguishable from a bad token and impossible to diagnose
                    // from a customer's log file.
                    TenantContext.clear();
                    logger.debug("Could not authenticate bearer token for '" + username + "': "
                            + e.getClass().getSimpleName() + ": " + e.getMessage());
                }
            }

            filterChain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }
}