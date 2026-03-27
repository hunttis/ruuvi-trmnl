import { WeatherData, WeatherHour } from "@/lib/types";

const SYMBOL_TEXT: Record<number, string> = {
  1: "Clear",
  2: "Partly cloudy",
  3: "Cloudy",
  21: "Light showers",
  22: "Showers",
  23: "Heavy showers",
  31: "Light rain",
  32: "Rain",
  33: "Heavy rain",
  41: "Light snow showers",
  42: "Snow showers",
  43: "Heavy snow showers",
  51: "Light snow",
  52: "Snow",
  53: "Heavy snow",
  61: "Thunder",
  62: "Heavy thunder",
  71: "Light sleet showers",
  72: "Sleet showers",
  73: "Heavy sleet showers",
  81: "Light sleet",
  82: "Sleet",
  83: "Heavy sleet",
};

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export class FmiCollector {
  private readonly place: string;
  private readonly hoursAhead: number;
  private cachedData: WeatherData | null = null;
  private cacheTime: number = 0;

  constructor(place: string = "Helsinki", hoursAhead: number = 6) {
    this.place = place;
    this.hoursAhead = hoursAhead;
  }

  public async fetchWeather(): Promise<WeatherData | null> {
    if (this.cachedData && Date.now() - this.cacheTime < CACHE_TTL_MS) {
      return this.cachedData;
    }

    try {
      const now = new Date();
      const endTime = new Date(
        now.getTime() + this.hoursAhead * 60 * 60 * 1000
      );

      const url =
        `https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0` +
        `&request=getFeature` +
        `&storedquery_id=fmi::forecast::hirlam::surface::point::simple` +
        `&place=${encodeURIComponent(this.place)}` +
        `&parameters=Temperature,FeelsLike,WeatherSymbol3,Precipitation1h` +
        `&timestep=60` +
        `&starttime=${now.toISOString()}` +
        `&endtime=${endTime.toISOString()}`;

      const response = await fetch(url, {
        headers: { "User-Agent": "RuuviTRMNL/1.0" },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`FMI API returned HTTP ${response.status}`);
      }

      const xml = await response.text();
      const data = this.parseXml(xml);

      if (data) {
        this.cachedData = data;
        this.cacheTime = Date.now();
      }

      return data;
    } catch (error: any) {
      console.error(`FMI weather fetch failed: ${error?.message ?? error}`);
      return this.cachedData; // return stale cache on error if available
    }
  }

  private parseXml(xml: string): WeatherData | null {
    const elementRegex =
      /<BsWfs:BsWfsElement[^>]*>([\s\S]*?)<\/BsWfs:BsWfsElement>/g;
    const timeRegex = /<BsWfs:Time>(.*?)<\/BsWfs:Time>/;
    const paramNameRegex = /<BsWfs:ParameterName>(.*?)<\/BsWfs:ParameterName>/;
    const paramValueRegex =
      /<BsWfs:ParameterValue>(.*?)<\/BsWfs:ParameterValue>/;

    const timeData = new Map<string, Record<string, number>>();

    let match;
    while ((match = elementRegex.exec(xml)) !== null) {
      const element = match[1];
      const timeMatch = timeRegex.exec(element);
      const nameMatch = paramNameRegex.exec(element);
      const valueMatch = paramValueRegex.exec(element);

      if (timeMatch && nameMatch && valueMatch) {
        const time = timeMatch[1];
        const name = nameMatch[1];
        const value = parseFloat(valueMatch[1]);

        if (!isNaN(value)) {
          if (!timeData.has(time)) {
            timeData.set(time, {});
          }
          timeData.get(time)![name] = value;
        }
      }
    }

    if (timeData.size === 0) {
      return null;
    }

    const sortedTimes = Array.from(timeData.keys()).sort();

    const toWeatherHour = (isoTime: string): WeatherHour => {
      const data = timeData.get(isoTime)!;
      const symbol = Math.round(data["WeatherSymbol3"] ?? 3);
      const time = new Date(isoTime).toLocaleTimeString("fi-FI", {
        timeZone: "Europe/Helsinki",
        hour: "2-digit",
        minute: "2-digit",
      });

      return {
        time,
        temperature: Math.round((data["Temperature"] ?? 0) * 10) / 10,
        feelsLike: Math.round((data["FeelsLike"] ?? 0) * 10) / 10,
        symbol,
        symbolText: SYMBOL_TEXT[symbol] ?? "Unknown",
        precipitation: Math.round((data["Precipitation1h"] ?? 0) * 10) / 10,
      };
    };

    const current = toWeatherHour(sortedTimes[0]);
    const forecast = sortedTimes
      .slice(1, this.hoursAhead)
      .map(toWeatherHour);

    return {
      location: this.place,
      current,
      forecast,
      fetchedAt: new Date().toISOString(),
    };
  }
}
