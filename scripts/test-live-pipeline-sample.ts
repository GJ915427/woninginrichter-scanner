import { LivePipelineEvaluator } from '../src/domain/pipeline/live-pipeline-evaluator';

async function testLivePipeline() {
  const evaluator = new LivePipelineEvaluator();
  const testAddresses = [
    { type: 'Tussenwoning', query: 'Singel 13 Bussum' },
    { type: 'Hoekwoning', query: 'Rijksweg 153B Gronsveld' },
    { type: 'Twee-onder-een-kap', query: 'Parklaan 10 Haarlem' },
    { type: 'Vrijstaand', query: 'Amersfoortsestraatweg 45 Bussum' },
    { type: 'Appartement', query: 'Sarphatistraat 40A Amsterdam' },
    { type: 'Samengesteld', query: 'Domplein 4 Utrecht' }
  ];

  console.log('=== TEST LIVE PIPELINE OP 6 TYPOLOGISCHE REFERENTIEWONINGEN ===\n');

  for (const t of testAddresses) {
    console.log('--------------------------------------------------');
    console.log('>> Bevraging:', t.type, '|', t.query);
    const start = Date.now();
    try {
      const result = await evaluator.evaluateAddress(t.query);
      const elapsed = Date.now() - start;

      if (!result) {
        console.log('[-] Geen resultaat gevonden');
        continue;
      }

      console.log('[+] Resultaat binnen', elapsed + 'ms:');
      console.log('    - Pand ID:', result.pandId);
      console.log('    - VBO ID:', result.telemetry.vboId || 'Geen VBO');
      console.log('    - Bouwjaar:', result.telemetry.bouwjaar || 'Onbekend');
      console.log('    - VBO Oppervlakte:', result.telemetry.oppervlakteVboM2 ? result.telemetry.oppervlakteVboM2 + ' m²' : 'Onbekend');
      console.log('    - BAG 2D Footprint:', result.telemetry.bagFootprint2D.length, 'hoekpunten');
      console.log('    - Maaiveld NAP:', result.telemetry.groundNapM !== undefined ? result.telemetry.groundNapM + 'm' : 'Niet beschikbaar');
      console.log('    - Goothoogte NAP:', result.telemetry.eavesNapM !== undefined ? result.telemetry.eavesNapM + 'm' : 'Niet beschikbaar');
      console.log('    - Nokhoogte NAP:', result.telemetry.ridgeNapM !== undefined ? result.telemetry.ridgeNapM + 'm' : 'Niet beschikbaar');
      console.log('    - DKK Perceelnummer:', result.telemetry.perceelnummer || 'Geen DKK perceel');
      console.log('    - Berekende Verdiepingen:', result.calculatedFloors.map(f => f.name + ' (' + f.areaM2 + ' m²)').join(', '));
    } catch (err) {
      console.error('[-] Fout bij bevraging:', (err as Error).message);
    }
  }
}

testLivePipeline()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
