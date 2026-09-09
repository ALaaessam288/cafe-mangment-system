package com.example.cafemangmentsystem.inventory.entity;

/** Why a raw material's stock changed. */
public enum RawMaterialMovementType {

    /** A purchase or delivery arriving. Positive quantity, and the only type that carries a cost. */
    RESTOCK("توريد"),

    /** Spoilage, breakage, spillage. Negative quantity, valued at the material's standing cost. */
    WASTE("هالك"),

    /** A manual correction to the number, with a reason. Signed either way. */
    CORRECTION("تصحيح"),

    /** The opening count of a shift stocktake — sets the number rather than adjusting it. */
    AUDIT_OPENING("جرد بداية وردية"),

    /** The closing count of a shift stocktake. The delta is the variance nobody accounted for. */
    AUDIT_CLOSING("جرد نهاية وردية");

    private final String displayNameAr;

    RawMaterialMovementType(String displayNameAr) {
        this.displayNameAr = displayNameAr;
    }

    public String getDisplayNameAr() {
        return displayNameAr;
    }

    /** Whether this type represents money leaving or entering the business, rather than a recount. */
    public boolean isFinancial() {
        return this == RESTOCK || this == WASTE;
    }
}
