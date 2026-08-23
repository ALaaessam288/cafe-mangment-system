package com.example.cafemangmentsystem.station.repository;

import com.example.cafemangmentsystem.station.entity.Station;
import com.example.cafemangmentsystem.station.entity.StationCode;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface StationRepository extends JpaRepository<Station, Long> {

    boolean existsByCode(StationCode code);

    Optional<Station> findByCode(StationCode code);

    Optional<Station> findFirstByCode(StationCode code);

    java.util.List<Station> findAllByCode(StationCode code);
}