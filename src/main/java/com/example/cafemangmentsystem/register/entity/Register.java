package com.example.cafemangmentsystem.register.entity;

import com.example.cafemangmentsystem.common.entity.SoftDeletableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "registers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Register extends SoftDeletableEntity {

    @Column(nullable = false)
    private String name;
}
