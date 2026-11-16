#pragma once
class SPIClass {
public:
  void begin() {}
  void begin(int, int, int, int) {}
};
inline SPIClass SPI;
