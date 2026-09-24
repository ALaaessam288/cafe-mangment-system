package com.example.cafemangmentsystem.station.entity;

/**
 * Where an item is prepared - which is a different question from which revenue line it belongs to.
 *
 * <p>FRIDGE exists because a bottle of water and a can of soft drink are not prepared anywhere.
 * They were being routed to the kitchen along with the food, so the chef was handed a slip asking
 * for two waters he has nothing to do with, and the person who actually fetches them - standing at
 * the cooler - got no slip at all. A station is "who picks this up", and a fridge is a third
 * answer to that, not a variation on the other two.
 *
 * <p>Revenue line is untouched by this: fridge items are still BUFFET money. Where a thing is made
 * and which side of the business it belongs to are separate facts and the system already keeps
 * them apart.
 */
public enum StationCode {
    KITCHEN,
    BAR,
    FRIDGE
}
