package com.example.cafemangmentsystem.security;

import com.example.cafemangmentsystem.billing.web.FeatureGuardInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@RequiredArgsConstructor
public class SpaWebConfig implements WebMvcConfigurer {

    private final FeatureGuardInterceptor featureGuardInterceptor;

    /**
     * Plan-feature enforcement runs here rather than in a servlet filter so it can read the
     * {@code @RequiresFeature} annotation off the resolved handler method.
     */
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(featureGuardInterceptor).addPathPatterns("/api/**");
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/assets/**")
                .addResourceLocations("classpath:/static/assets/")
                .setCachePeriod(31536000);
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/")
                .setCachePeriod(0);
    }

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        // Fallback for SPA routing: route all non-API and non-file paths to index.html
        registry.addViewController("/{path:[^\\.]*}")
                .setViewName("forward:/index.html");
        registry.addViewController("/**/{path:[^\\.]*}")
                .setViewName("forward:/index.html");
    }
}
