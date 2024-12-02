#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"
#include <ESP32Servo.h>
#include <HTTPClient.h>
#include "DHT.h"
#include "HX711.h"

#define WIFI_SSID "Sake"
#define WIFI_PASSWORD "987123654"
#define API_KEY "API_KEY"
#define DATABASE_URL "https://fishtank-2b906-default-rtdb.asia-southeast1.firebasedatabase.app/"

#define waterlevelPIN 39
#define LOADCELL_DOUT_PIN 16
#define LOADCELL_SCK_PIN 4
#define servoPIN 5

HX711 scale;

Servo myServo;

HardwareSerial Receiver(2);

// Google Apps Script Web App URL
const char* serverName = "https://script.google.com/macros/s/AKfycbwXlh6Oyzqz1bRrKV5vmMB_5pXSjAePjEevJog3kmg2wi0bGDAzjMxVpzZPW9dzeSDV/exec";

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

bool signupOK = false;
bool waterLevelData = false;
float phData = 0;
float tempData = 0;
float weightData = 0;
bool servoStatus = false;

bool finishedServo = false;

void setup() {
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(300);
  }
  Serial.println();
  Serial.print("Connected with IP:");
  Serial.println(WiFi.localIP());

  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("signUp OK");
    signupOK = true;
  } else {
    Serial.println(config.signer.signupError.message.c_str());
  }

  config.token_status_callback = tokenStatusCallback;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  Receiver.begin(115200, SERIAL_8N1, 27, 12);
  scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
  scale.set_scale(724.394841);
  scale.tare();

  myServo.attach(servoPIN);
  myServo.write(120);
}

void loop() {
  if (Firebase.ready() && signupOK) { // & (millis() - sendDataPrevMills > 1000 || sendDataPrevMills == 0)
    if (Firebase.RTDB.getBool(&fbdo, "Sensor/servoStatus")) {
      if (fbdo.dataType() == "boolean") {
        servoStatus = fbdo.boolData();
        Serial.print("Servo : ");
        Serial.println(servoStatus);
        if (servoStatus) {
          if (!finishedServo)
          {
            myServo.write(180);
            delay(1500);
            myServo.write(120);
            finishedServo = true;
          }
        }
        else finishedServo = false;
      }
    } else {
      Serial.println("Failed to read servo status: " + fbdo.errorReason());
    }

    String text = "";
    bool start = false;
    while (Receiver.available()) {
        char RxdChar = Receiver.read();
        if (RxdChar == 'd') {
          text = "";
          start = true;
        }
        else if (RxdChar == 't' && start) {
          phData = text.toFloat();
          text = "";
        }
        else if (RxdChar == '\n' && start) {
          tempData = text.toFloat();
          start = false;
          while(Receiver.available()) Receiver.read();
          break;
        }
        else text += RxdChar;
    }
    waterLevelData = (analogRead(waterlevelPIN) > 100) ? true : false;
    if (scale.is_ready()) weightData = scale.get_units(10);
  
    if (Firebase.RTDB.setBool(&fbdo, "Sensor/waterLevelData", waterLevelData)) {
      Serial.print(waterLevelData);
      Serial.print(" - successfully saved to: " + fbdo.dataPath());
      Serial.println("(" + fbdo.dataType() + ")");
    } else {
      Serial.println("FAILED: " + fbdo.errorReason());
    }
    if (Firebase.RTDB.setFloat(&fbdo, "Sensor/phData", phData)) {
      Serial.print(phData);
      Serial.print(" - successfully saved to: " + fbdo.dataPath());
      Serial.println("(" + fbdo.dataType() + ")");
    } else {
      Serial.println("FAILED: " + fbdo.errorReason());
    }
    if (Firebase.RTDB.setFloat(&fbdo, "Sensor/tempData", tempData)) {
      Serial.print(tempData);
      Serial.print(" - successfully saved to: " + fbdo.dataPath());
      Serial.println("(" + fbdo.dataType() + ")");
    } else {
      Serial.println("FAILED: " + fbdo.errorReason());
    }
    if (Firebase.RTDB.setFloat(&fbdo, "Sensor/weightData", weightData)) {
      Serial.print(weightData);
      Serial.print(" - successfully saved to: " + fbdo.dataPath());
      Serial.println("(" + fbdo.dataType() + ")");
    } else {
      Serial.println("FAILED: " + fbdo.errorReason());
    }

    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      http.begin(serverName);
      http.addHeader("Content-Type", "application/json");
      String jsonData = "{\"method\":\"append\", \"phData\":" + String(phData) +
                        ", \"tempData\":" + String(tempData) +
                        ", \"weightData\":" + String(weightData) +
                        ", \"waterLevelData\":" + (waterLevelData ? "true" : "false") +
                        ", \"servoStatus\":" + "true" +
                        "}";
      int httpResponseCode = http.POST(jsonData);
      if (httpResponseCode > 0) {
        Serial.println("Data sent to Google Sheets successfully.");
        // Serial.println(http.getString());
      } else {
        Serial.println("Error sending data to Google Sheets: " + String(httpResponseCode));
      }
      http.end();
    } else {
      Serial.println("WiFi Disconnected");
    }
  }
}
