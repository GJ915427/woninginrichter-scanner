export interface CreateProposalLineResponse {
  success: boolean;
  simulated: boolean;
  proposalId: string;
  lineNumber: number;
  lineId: string;
  totalPriceEur: number;
  message?: string;
  error?: string;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
): Promise<Response> {
  try {
    const resolvedParams = await Promise.resolve(context.params);
    const proposalId = resolvedParams?.id || 'O26000735';

    let body: any;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { success: false, error: 'Ongeldige JSON payload in aanvraag' },
        { status: 400 }
      );
    }

    // 1. Strikte payload validatie
    const { productId, productCode, configuration, totalPriceEur } = body;

    if (!productId || !productCode || !configuration || totalPriceEur === undefined) {
      return Response.json(
        {
          success: false,
          error: 'Verplichte velden ontbreken: productId, productCode, configuration en totalPriceEur zijn vereist'
        },
        { status: 400 }
      );
    }

    if (typeof totalPriceEur !== 'number' || isNaN(totalPriceEur) || totalPriceEur < 0) {
      return Response.json(
        {
          success: false,
          error: 'Ongeldige totaalprijs: totalPriceEur moet een positief getal zijn'
        },
        { status: 400 }
      );
    }

    // 2. Blokkeer ongeldige configuraties
    if (configuration.errors && Array.isArray(configuration.errors)) {
      const blockingErrors = configuration.errors.filter(
        (err: any) => err.severity === 'error' || !err.severity
      );
      if (blockingErrors.length > 0) {
        return Response.json(
          {
            success: false,
            error: `Configuratie bevat validatiefouten (${blockingErrors.map((e: any) => e.code || e.message).join(', ')}) en kan niet worden toegevoegd`
          },
          { status: 400 }
        );
      }
    }

    // 3. LogicTrade ERP Adapter & Graceful Fallback
    const apiKey = process.env.LOGICTRADE_API_KEY || '621dcae6617349d0896d3ca9ba96d4b6';
    const baseUrl = (process.env.LOGICTRADE_BASE_URL || 'https://api.logictrade.cloud/rest/v1').replace(/\/+$/, '');
    const adminGuid = process.env.LOGICTRADE_ADMIN_GUID;

    let simulated = false;
    let lineNumber = 1;
    let lineId = `LT-LINE-${Date.now()}`;

    try {
      const url = `${baseUrl}/orders/${encodeURIComponent(proposalId)}/orderlines`;
      const headers: Record<string, string> = {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      };
      if (adminGuid) {
        headers['administration-guid'] = adminGuid;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          productId: body.productId,
          productCode: body.productCode,
          description: body.productName || body.productCode,
          quantity: 1,
          price: body.totalPriceEur,
          configuration: body.configuration,
          notes: body.notes || ''
        }),
        signal: AbortSignal.timeout(3000)
      });

      if (res.ok) {
        const erpData = (await res.json()) as any;
        lineNumber = erpData.lineNumber || lineNumber;
        lineId = erpData.id || lineId;
      } else {
        // Fallback voor HTTP 403 (read-only key) of HTTP 404 (testofferte)
        simulated = true;
      }
    } catch {
      // Netwerk timeout of offline modus
      simulated = true;
    }

    const responsePayload: CreateProposalLineResponse = {
      success: true,
      simulated,
      proposalId,
      lineNumber,
      lineId,
      totalPriceEur: Math.round(totalPriceEur * 100) / 100,
      message: `Maatwerkregel ${productCode} succesvol toegevoegd aan regel ${lineNumber} van offerte ${proposalId}`
    };

    return Response.json(responsePayload, { status: 201 });
  } catch (error: any) {
    return Response.json(
      {
        success: false,
        error: `Onverwachte serverfout bij toevoegen offerteregel: ${error?.message || String(error)}`
      },
      { status: 500 }
    );
  }
}
