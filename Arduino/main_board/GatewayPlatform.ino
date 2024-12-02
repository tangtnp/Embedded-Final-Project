#include <OneWire.h>
#include <DallasTemperature.h>

HardwareSerial Sender(1);
HardwareSerial Receiver(2);

#define ONE_WIRE_BUS 33
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

#define analogPhPin 32

long phTot;
float phAvg;
int x;
float m = -0.85;
float C = 19.37;

int i=0;

void setup()
{
  Serial.begin(115200);
  Sender.begin(115200, SERIAL_8N1, 27, 12);
  sensors.begin();
}

void loop() {
  phTot = 0;
  phAvg = 0;
  for(x=0; x<10 ; x++)
  {
      phTot += analogRead(32);
      delay(10);
  }
  float phAvg = phTot/10;
  float phVoltage = phAvg * (5.0 / 1023.0);
  float pHValue = phVoltage * m+C;
  sensors.requestTemperatures();
  Sender.print("d");
  Sender.print(pHValue);
  Sender.print("t");
  Sender.println(sensors.getTempCByIndex(0));

  Serial.print("d");
  Serial.print(pHValue);
  Serial.print("t");
  Serial.println(sensors.getTempCByIndex(0));
  delay(1000);
}
