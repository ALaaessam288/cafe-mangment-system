package com.example.cafemangmentsystem.billing;

import com.example.cafemangmentsystem.billing.entity.Feature;

import java.lang.annotation.*;

/**
 * Declares that a controller or handler method needs a plan feature.
 *
 * <p>Replaces gating by URL prefix inside the servlet filter ({@code path.startsWith("/api/stations")}),
 * which silently stopped protecting an endpoint the moment someone changed its mapping, only ever
 * covered two of the features the plans actually sold, and left reads open on every one of them.
 */
@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface RequiresFeature {

    Feature value();

    /**
     * Whether GET requests are gated too. Defaults to true: if a plan doesn't include KDS, the
     * tenant should not be reading the KDS either.
     */
    boolean gateReads() default true;
}
