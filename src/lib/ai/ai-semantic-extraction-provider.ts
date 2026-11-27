/**
 * src/lib/ai/ai-semantic-extraction-provider.ts
 *
 * Zero-dependency native fetch + zod implementatie van ICognitiveExtractionProvider
 * via de officiële Google Gemini REST API (gemini-2.5-flash).
 * Handhaaft fail-closed error handling en deterministische pre-flight API-key validatie.
 */

import type {
  ICognitiveExtractionProvider,
  RawOrderLineInput,
  CognitiveExtractionContext,
  ConfigurationSpec,
} from '@/types/order-intake';
import { ConfigurationSpecSchema } from '@/domain/orders/configuration-schemas';

export interface AiSemanticExtractionProviderOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export class AiSemanticExtractionProvider implements ICognitiveExtractionProvider {
  private apiKey: string | undefined;
  private model: string;
  private baseUrl: string;

  constructor(options?: AiSemanticExtractionProviderOptions) {
    this.apiKey = options?.apiKey || process.env.GEMINI_API_KEY;
    this.model = options?.model || 'gemini-2.5-flash';
    this.baseUrl = options?.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
  }

  public async extract(
    input: RawOrderLineInput | CognitiveExtractionContext,
    productGroupCode?: string
  ): Promise<ConfigurationSpec> {
    const rawLine = 'line' in input ? input.line : input;
    const context = 'line' in input ? input : undefined;

    // 1. Deterministische Pre-Flight API-sleutel check (Fail-Closed, zero network roundtrip)
    const effectiveKey = this.apiKey || process.env.GEMINI_API_KEY;
    if (!effectiveKey) {
      return {
        status: 'requires_review',
        confidence: 0.1,
        source: 'cognitive',
        extraction_notes: ['GEMINI_API_KEY ontbreekt in runtime context'],
      };
    }

    try {
      const prompt = this.buildPrompt(rawLine, context, productGroupCode);
      const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${effectiveKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return {
            status: 'requires_review',
            confidence: 0.1,
            source: 'cognitive',
            extraction_notes: ['Gemini API HTTP 429 rate limit bereikt - fail-closed naar review'],
          };
        }
        return {
          status: 'requires_review',
          confidence: 0.1,
          source: 'cognitive',
          extraction_notes: [`Gemini API HTTP ${response.status} fout`],
        };
      }

      const json = await response.json();
      const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        return {
          status: 'requires_review',
          confidence: 0.1,
          source: 'cognitive',
          extraction_notes: ['Lege response van Gemini API'],
        };
      }

      const parsedJson = JSON.parse(rawText);
      const validation = ConfigurationSpecSchema.safeParse(parsedJson);

      if (!validation.success) {
        return {
          status: 'requires_review',
          confidence: 0.2,
          source: 'cognitive',
          extraction_notes: ['Gemini output voldeed niet aan ConfigurationSpecSchema contract'],
        };
      }

      return validation.data;
    } catch (err: unknown) {
      return {
        status: 'requires_review',
        confidence: 0.1,
        source: 'cognitive',
        extraction_notes: [`Netwerk- of parsingfout in AiSemanticExtractionProvider: ${err instanceof Error ? err.message : String(err)}`],
      };
    }
  }

  private buildPrompt(
    line: RawOrderLineInput,
    context?: CognitiveExtractionContext,
    candidateGroup?: string
  ): string {
    const adjacent = (context?.adjacentLines || [])
      .filter((l) => l.line_number !== line.line_number)
      .map((l) => `Regel ${l.line_number}: [${l.product_code || 'GEEN_SKU'}] ${l.description} | Aant: ${l.quantity || 1}`)
      .join('\n');

    return `Je bent een Woninginrichting Neuro-Symbolische Specificatie Extractor.
Analyseer de onderstaande orderregel in context van de gehele order en retourneer een valide JSON object conform het ConfigurationSpec schema.

ORDERREGEL:
- Regelnummer: ${line.line_number}
- Artikelcode: ${line.product_code || 'ONBEKEND'}
- Omschrijving: ${line.description}
- Notities: ${line.notes || 'Geen'}
- Hoeveelheid: ${line.quantity || 1} ${line.unit || 'stuks'}
- Catalogus Match: ${context?.catalogProduct?.name || 'Geen'} (${context?.catalogProduct?.product_group_code || candidateGroup || '9.9'})
- Generieke Container: ${context?.catalogProduct?.is_generic_container ? 'JA' : 'NEE'}

AANPALENDE ORDERREGELS UIT DEZELFDE ORDER (CONTEXT):
${adjacent || 'Geen aanpalende regels'}

JSON Formaat:
{
  "status": "valid" | "incomplete" | "requires_review",
  "confidence": number tussen 0 en 1,
  "source": "cognitive",
  "dimensions": { "width_mm": number (100-12000), "height_mm": number (100-12000) },
  "options": string[],
  "attributes": Record<string, unknown>,
  "extraction_notes": string[]
}`;
  }
}
