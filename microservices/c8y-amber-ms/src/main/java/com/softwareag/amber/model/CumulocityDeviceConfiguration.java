package com.softwareag.amber.model;

import lombok.Data;

import javax.validation.constraints.NotNull;

@Data
public class CumulocityDeviceConfiguration {

    private String id;

    private @NotNull AmberSensorConfiguration configuration;

    private @NotNull CumulocityDataPoint[] dataPoints;

    private String[] childDevices;
}
