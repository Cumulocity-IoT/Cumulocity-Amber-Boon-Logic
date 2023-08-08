package com.softwareag.amber.model;

import com.cumulocity.model.util.Alias;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import org.svenson.AbstractDynamicProperties;
import org.svenson.JSONProperty;

@Alias("c8y_AmberSensorConfiguration")
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class AmberSensor extends AbstractDynamicProperties {

    private String sensorId;

    private String label;

    @JsonInclude(JsonInclude.Include.NON_NULL)
    private UsageInfo usageInfo;

    @JsonInclude(JsonInclude.Include.NON_NULL)
    private AmberSensorConfiguration configuration;

    @JsonInclude(JsonInclude.Include.NON_NULL)
    private CumulocityDataPoint[] dataPoints;

    @JsonInclude(JsonInclude.Include.NON_NULL)
    private String[] ChildDevices;

    @JsonInclude(JsonInclude.Include.NON_NULL)
    private boolean isStreaming;

    @JsonIgnore
    private long timestampOfLastMonitoringEventSent;

    @JSONProperty(
            ignoreIfNull = true
    )
    public UsageInfo getUsageInfo() {
        return usageInfo;
    }

    @JSONProperty(value = "isStreaming")
    public boolean isStreaming() {
        return isStreaming;
    }

    public void setUsageInfo(UsageInfo usageInfo) {
        this.usageInfo = usageInfo;
    }

    @Data
    public class UsageInfo {
        private CallStatistics getAmberSummary;

        private CallStatistics getConfig;

        private CallStatistics getPretrain;

        private CallStatistics getRootCause;

        private CallStatistics getSensor;

        private CallStatistics getStatus;

        private CallStatistics postConfig;

        private CallStatistics postPretrain;

        private CallStatistics postStream;

        private CallStatistics putSensor;

        @Data
        public class CallStatistics {
            private long callsThisPeriod;

            private long callsTotal;

            private String lastCalled;

            private long samplesThisPeriod;

            private long samplesTotal;
        }
    }
}
