package com.softwareag.amber.client;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.softwareag.amber.model.*;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpServerErrorException;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Optional;

@Slf4j
public class AmberClient {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final String url;

    private AmberOAuthConfiguration oAuthConfiguration;

    private long reauthTime;

    public AmberClient(@NonNull String url, @NonNull AmberCredentials credentials) throws HttpServerErrorException {
        this.url = url;
        this.reauthTime = System.currentTimeMillis() / 1000l;
        initOAuth(url, credentials);
    }

    public int getOAuthTokenExpiresTime() {
        return Integer.parseInt(oAuthConfiguration.getExpiresIn());
    }

    public AmberSensor[] getSensors() throws HttpServerErrorException {
        if (this.oAuthVerify() == false) {
            log.error("OAuth configuration isn't set");
            throw new HttpServerErrorException(HttpStatus.INTERNAL_SERVER_ERROR);
        }

        try {
            final HttpRequest request = HttpRequest.newBuilder(new URI(url + "/sensors"))
                    .header("Authorization", "Bearer " + oAuthConfiguration.getIdToken())
                    .header("Content-Type", "application/json")
                    .GET()
                    .build();

            HttpResponse<String> response = HttpClient.newBuilder()
                    .build()
                    .send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != HttpStatus.OK.value()) {
                throw new HttpServerErrorException(HttpStatus.resolve(response.statusCode()), response.body());
            }

            return OBJECT_MAPPER.readValue(response.body(), AmberSensor[].class);
        } catch (URISyntaxException e) {
            e.printStackTrace();
        } catch (InterruptedException e) {
            e.printStackTrace();
        } catch (IOException e) {
            e.printStackTrace();
        }

        throw new HttpServerErrorException(HttpStatus.INTERNAL_SERVER_ERROR);
    }

    public AmberSensor createSensor() throws HttpServerErrorException {
        if (this.oAuthVerify() == false) {
            log.error("OAuth configuration isn't set");
            throw new HttpServerErrorException(HttpStatus.INTERNAL_SERVER_ERROR);
        }

        try {
            final HttpRequest request = HttpRequest.newBuilder(new URI(url + "/sensor"))
                    .header("Authorization", "Bearer " + oAuthConfiguration.getIdToken())
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString("{\"label\":\"\"}"))
                    .build();

            HttpResponse<String> response = HttpClient.newBuilder()
                    .build()
                    .send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != HttpStatus.OK.value()) {
                throw new HttpServerErrorException(HttpStatus.resolve(response.statusCode()), response.body());
            }

            return OBJECT_MAPPER.readValue(response.body(), AmberSensor.class);
        } catch (URISyntaxException e) {
            e.printStackTrace();
        } catch (InterruptedException e) {
            e.printStackTrace();
        } catch (IOException e) {
            e.printStackTrace();
        }

        throw new HttpServerErrorException(HttpStatus.INTERNAL_SERVER_ERROR);
    }

    public Optional<AmberSensor> getSensor(final String sensorId) throws HttpServerErrorException {
        if (this.oAuthVerify() == false) {
            log.error("OAuth configuration isn't set");
            throw new HttpServerErrorException(HttpStatus.INTERNAL_SERVER_ERROR);
        }

        final HttpRequest request;
        try {
            request = HttpRequest.newBuilder(new URI(url + "/sensor"))
                    .header("Authorization", "Bearer " + oAuthConfiguration.getIdToken())
                    .header("Content-Type", "application/json")
                    .header("sensorId", sensorId)
                    .GET()
                    .build();

            HttpResponse<String> response = HttpClient.newBuilder()
                    .build()
                    .send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != HttpStatus.OK.value()) {
                throw new HttpServerErrorException(HttpStatus.resolve(response.statusCode()), response.body());
            }

            return Optional.of(OBJECT_MAPPER.readValue(response.body(), AmberSensor.class));
        } catch (URISyntaxException e) {
            e.printStackTrace();
        } catch (InterruptedException e) {
            e.printStackTrace();
        } catch (IOException e) {
            e.printStackTrace();
        }

        throw new HttpServerErrorException(HttpStatus.INTERNAL_SERVER_ERROR);
    }

    public void deleteSensor(final String sensorId) throws HttpServerErrorException {
        if (this.oAuthVerify() == false) {
            log.error("OAuth configuration isn't set");
            throw new HttpServerErrorException(HttpStatus.INTERNAL_SERVER_ERROR);
        }

        final HttpRequest request;
        try {
            request = HttpRequest.newBuilder(new URI(url + "/sensor"))
                    .header("Authorization", "Bearer " + oAuthConfiguration.getIdToken())
                    .header("Content-Type", "application/json")
                    .header("sensorId", sensorId)
                    .DELETE()
                    .build();

            HttpResponse<String> response = HttpClient.newBuilder()
                    .build()
                    .send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != HttpStatus.OK.value()) {
                throw new HttpServerErrorException(HttpStatus.resolve(response.statusCode()), response.body());
            }

            return;
        } catch (URISyntaxException e) {
            e.printStackTrace();
        } catch (InterruptedException e) {
            e.printStackTrace();
        } catch (IOException e) {
            e.printStackTrace();
        }

        throw new HttpServerErrorException(HttpStatus.INTERNAL_SERVER_ERROR);
    }

    public AmberSensorConfiguration createSensorConfiguration(final String sensorId, final AmberSensorConfiguration configuration) throws HttpServerErrorException {
        if (this.oAuthVerify() == false) {
            log.error("OAuth configuration isn't set");
            throw new HttpServerErrorException(HttpStatus.INTERNAL_SERVER_ERROR);
        }

        try {
            final String sensorConfigurationJson = new ObjectMapper().writeValueAsString(configuration);
            final HttpRequest request = HttpRequest.newBuilder(new URI(url + "/config"))
                    .header("Authorization", "Bearer " + oAuthConfiguration.getIdToken())
                    .header("Content-Type", "application/json")
                    .header("sensorId", sensorId)
                    .POST(HttpRequest.BodyPublishers.ofString(sensorConfigurationJson))
                    .build();

            HttpResponse<String> response = HttpClient.newBuilder()
                    .build()
                    .send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != HttpStatus.OK.value()) {
                throw new HttpServerErrorException(HttpStatus.resolve(response.statusCode()), response.body());
            }

            return OBJECT_MAPPER.readValue(response.body(), AmberSensorConfiguration.class);
        } catch (URISyntaxException e) {
            e.printStackTrace();
        } catch (InterruptedException e) {
            e.printStackTrace();
        } catch (IOException e) {
            e.printStackTrace();
        }

        throw new HttpServerErrorException(HttpStatus.INTERNAL_SERVER_ERROR);
    }

    public AmberSensorConfiguration getSensorConfiguration(final String sensorId) throws HttpServerErrorException {
        if (this.oAuthVerify() == false) {
            log.error("OAuth configuration isn't set");
            throw new HttpServerErrorException(HttpStatus.INTERNAL_SERVER_ERROR);
        }

        try {
            final HttpRequest request = HttpRequest.newBuilder(new URI(url + "/config"))
                    .header("Authorization", "Bearer " + oAuthConfiguration.getIdToken())
                    .header("Content-Type", "application/json")
                    .header("sensorId", sensorId)
                    .GET()
                    .build();

            HttpResponse<String> response = HttpClient.newBuilder()
                    .build()
                    .send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != HttpStatus.OK.value()) {
                throw new HttpServerErrorException(HttpStatus.resolve(response.statusCode()), response.body());
            }

            return OBJECT_MAPPER.readValue(response.body(), AmberSensorConfiguration.class);
        } catch (URISyntaxException e) {
            e.printStackTrace();
        } catch (InterruptedException e) {
            e.printStackTrace();
        } catch (IOException e) {
            e.printStackTrace();
        }

        throw new HttpServerErrorException(HttpStatus.INTERNAL_SERVER_ERROR);
    }

    public AmberStreamData streamData(final String sensorId, final ServiceDataStream serviceDataStream) throws HttpServerErrorException {
        if (this.oAuthVerify() == false) {
            log.error("OAuth configuration isn't set");
            throw new HttpServerErrorException(HttpStatus.INTERNAL_SERVER_ERROR);
        }

        try {
            final String serviceDataStreamJson = new ObjectMapper().writeValueAsString(serviceDataStream);
            log.info("stream data: {}", serviceDataStreamJson);
            final HttpRequest request = HttpRequest.newBuilder(new URI(url + "/stream"))
                    .header("Authorization", "Bearer " + oAuthConfiguration.getIdToken())
                    .header("Content-Type", "application/json")
                    .header("sensorId", sensorId)
                    .POST(HttpRequest.BodyPublishers.ofString(serviceDataStreamJson))
                    .build();

            HttpResponse<String> response = HttpClient.newBuilder()
                    .build()
                    .send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != HttpStatus.OK.value()) {
                throw new HttpServerErrorException(HttpStatus.resolve(response.statusCode()), response.body());
            }

            return OBJECT_MAPPER.readValue(response.body(), AmberStreamData.class);
        } catch (URISyntaxException e) {
            e.printStackTrace();
        } catch (InterruptedException e) {
            e.printStackTrace();
        } catch (IOException e) {
            e.printStackTrace();
        }

        throw new HttpServerErrorException(HttpStatus.INTERNAL_SERVER_ERROR);
    }

    public double[] getRootCause(final String sensorId, final int clusterId) throws HttpServerErrorException {
        if (this.oAuthVerify() == false) {
            log.error("OAuth configuration isn't set");
            throw new HttpServerErrorException(HttpStatus.INTERNAL_SERVER_ERROR);
        }

        try {

            final HttpRequest request = HttpRequest.newBuilder(new URI(url + "/rootCause?clusterID=[" + clusterId + "]"))
                    .header("Authorization", "Bearer " + oAuthConfiguration.getIdToken())
                    .header("Content-Type", "application/json")
                    .header("sensorId", sensorId)
                    .GET()
                    .build();

            HttpResponse<String> response = HttpClient.newBuilder()
                    .build()
                    .send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != HttpStatus.OK.value()) {
                throw new HttpServerErrorException(HttpStatus.resolve(response.statusCode()), response.body());
            }

            return OBJECT_MAPPER.readValue(response.body(), double[][].class)[0];
        } catch (URISyntaxException e) {
            e.printStackTrace();
        } catch (InterruptedException e) {
            e.printStackTrace();
        } catch (IOException e) {
            e.printStackTrace();
        }

        throw new HttpServerErrorException(HttpStatus.INTERNAL_SERVER_ERROR);
    }

    private boolean oAuthVerify() {
        if (System.currentTimeMillis() / 1000l > this.reauthTime - 60) {
            try {
                // attempt authentication if reauthTime is within 60 seconds of expiring
                this.initOAuth();
            } catch (HttpServerErrorException e) {
                return false;
            }
        }
        return true;
    }

    public static HttpResponse<String> authenticate(final @NonNull String url, final @NonNull AmberCredentials amberCredentials)
            throws HttpServerErrorException {

        final String credentials = "{\n" +
                "  \"username\": \"" + amberCredentials.getUsername() + "\",\n" +
                "  \"password\": \"" + amberCredentials.getPassword() + "\"\n" +
                "}";

        try {
            final HttpRequest request = HttpRequest.newBuilder(new URI(url + "/oauth2"))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(credentials))
                    .build();

            HttpResponse<String> response = HttpClient.newBuilder()
                    .build()
                    .send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != HttpStatus.OK.value()) {
                throw new HttpServerErrorException(HttpStatus.resolve(response.statusCode()), response.body());
            }

            // save off time when next auth will be required
            this.reauthTime = System.currentTimeMillis() / 1000l + getOAuthTokenExpiresTime();

            return response;
        } catch (URISyntaxException e) {
            e.printStackTrace();
        } catch (InterruptedException e) {
            e.printStackTrace();
        } catch (IOException e) {
            e.printStackTrace();
        }

        throw new HttpServerErrorException(HttpStatus.INTERNAL_SERVER_ERROR);
    }

    private void initOAuth(@NonNull String url, @NonNull AmberCredentials credentials) {
        final HttpResponse<String> response = authenticate(url, credentials);

        if (response.statusCode() != HttpStatus.OK.value()) {
            throw new HttpServerErrorException(HttpStatus.resolve(response.statusCode()));
        }

        try {
            oAuthConfiguration = OBJECT_MAPPER.readValue(response.body(), AmberOAuthConfiguration.class);
            log.info("init oAuth done: {}", oAuthConfiguration.toString());
        } catch (JsonProcessingException e) {
            log.error("Error occurred when trying to set up the OAuth configuration", e);
            throw new HttpServerErrorException(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
