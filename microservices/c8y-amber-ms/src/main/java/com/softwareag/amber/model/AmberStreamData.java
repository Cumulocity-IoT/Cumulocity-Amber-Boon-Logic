package com.softwareag.amber.model;

import com.cumulocity.model.util.Alias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Alias("c8y_AmberSensorStatus")
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class AmberStreamData {

    private String state;

    private String message;

    private int clusterCount;

    private int sampleCount;

    private int progress;

    private int retryCount;

    private int streamingWindowSize;

    private int totalInferences;

    @JsonProperty("AD")
    private int[] AD;

    @JsonProperty("AH")
    private int[] AH;

    @JsonProperty("AM")
    private double[] AM;

    @JsonProperty("AW")
    private int[] AW;

    @JsonProperty("ID")
    private int[] ID;

    @JsonProperty("RI")
    private int[] RI;

    @JsonProperty("SI")
    private int[] SI;

    @JsonProperty("NI")
    private int[] NI;

    @JsonProperty("NS")
    private int[] NS;

    @JsonProperty("OM")
    private double[] OM;

    @JsonProperty("NW")
    private double[] NW;

     @JsonProperty("RC")
    private double[] RC;
}
