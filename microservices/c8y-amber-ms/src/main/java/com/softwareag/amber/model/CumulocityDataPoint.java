package com.softwareag.amber.model;

import lombok.Data;

@Data
public class CumulocityDataPoint {

    private String type;

    private String fragment;

    private String series;

    private String deviceId;
}
