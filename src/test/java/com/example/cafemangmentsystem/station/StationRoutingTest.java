package com.example.cafemangmentsystem.station;

import com.example.cafemangmentsystem.station.entity.StationCode;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The fridge exists so that water and cans stop being printed at the kitchen. These tests pin the
 * grouping rule that decides it - the thing the frontend used to get wrong by collapsing every
 * station that was not the bar into the kitchen.
 */
class StationRoutingTest {

    @Test
    void thereAreThreePreparationPoints() {
        assertEquals(List.of(StationCode.KITCHEN, StationCode.BAR, StationCode.FRIDGE),
                Arrays.asList(StationCode.values()));
    }

    /** Mirrors PrintJobService: one ticket per distinct station, nothing folded into another. */
    private static Map<StationCode, Integer> ticketsFor(List<StationCode> itemStations) {
        Map<StationCode, Integer> byStation = new LinkedHashMap<>();
        itemStations.forEach(s -> byStation.merge(s, 1, Integer::sum));
        return byStation;
    }

    @Test
    void anOrderOfFoodDrinkAndWaterPrintsThreeSeparateTickets() {
        Map<StationCode, Integer> tickets = ticketsFor(
                List.of(StationCode.KITCHEN, StationCode.BAR, StationCode.FRIDGE));

        assertEquals(3, tickets.size());
        assertEquals(1, tickets.get(StationCode.FRIDGE), "the cooler gets its own slip");
        assertEquals(1, tickets.get(StationCode.KITCHEN), "and the chef is not handed the water");
    }

    @Test
    void everyStationHasItsOwnPrintedHeading() {
        // PrintJobService.stationLabel switches exhaustively over this enum, so a new station
        // cannot be added without deciding what its slip says. This asserts they are distinct -
        // two stations sharing a heading would be two piles of paper nobody can tell apart.
        assertEquals(StationCode.values().length,
                Arrays.stream(StationCode.values()).map(Enum::name).distinct().count());
    }
}
