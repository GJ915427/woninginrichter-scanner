export interface EpOnlineData {
  label: string;
  glazingType: string;
  roofInsulated?: boolean;
  wallInsulated?: boolean;
  isRegistered: boolean;
}

export class EpOnlineClient {
  private readonly baseUrl = 'https://public.ep-online.nl/api/v3';

  /**
   * Haalt het officiële energielabel en isolatie-informatie op via postcode en huisnummer
   */
  async getEnergyData(
    postcode: string,
    huisnummer: number,
    huisnummertoevoeging?: string
  ): Promise<EpOnlineData> {
    const cleanPostcode = postcode.replace(/\s+/g, '').toUpperCase();
    const query = new URLSearchParams({
      postcode: cleanPostcode,
      huisnummer: huisnummer.toString(),
    });
    if (huisnummertoevoeging) {
      query.set('huisnummertoevoeging', huisnummertoevoeging);
    }

    try {
      const res = await fetch(`${this.baseUrl}/Pand/Energielabel?${query.toString()}`, {
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        return {
          label: 'ONBEKEND',
          glazingType: 'ONBEKEND',
          isRegistered: false,
        };
      }

      const data = await res.json();
      return {
        label: data.label || data.energielabel || 'ONBEKEND',
        glazingType: data.glazingType || data.glasType || 'HR++',
        roofInsulated: data.roofInsulated ?? true,
        wallInsulated: data.wallInsulated ?? true,
        isRegistered: true,
      };
    } catch {
      return {
        label: 'ONBEKEND',
        glazingType: 'ONBEKEND',
        isRegistered: false,
      };
    }
  }
}
