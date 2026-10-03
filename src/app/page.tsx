'use client';

import React, { useState } from 'react';
import { PlaceSidebar, ActiveView } from '@/components/sidebar/PlaceSidebar';
import { ViewerCanvas } from '@/components/layout/ViewerCanvas';
import { AddressSuggestion } from '@/data/pdok/pdok-locatieserver-client';

export default function Home() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState<ActiveView>('2d');
  const [searchedAddress, setSearchedAddress] = useState<string>('');
  const [currentPandId, setCurrentPandId] = useState<string>('');
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number }>({
    lat: 50.80529,
    lng: 5.73351,
  });
  const [isLoadingAddress, setIsLoadingAddress] = useState<boolean>(false);
  const [currentBuildingData, setCurrentBuildingData] = useState<any | null>(null);

  // Fetch full building data from BFF route /api/building
  const fetchBuildingDetails = async (pandId?: string, lat?: number, lng?: number) => {
    try {
      let url = '/api/building';
      if (pandId) {
        url += `?pandId=${encodeURIComponent(pandId)}`;
      } else if (lat !== undefined && lng !== undefined) {
        url += `?lat=${lat}&lng=${lng}`;
      } else {
        return;
      }

      const res = await fetch(url);
      if (res.ok) {
        const payload = await res.json();
        setCurrentBuildingData(payload);
      }
    } catch (err) {
      console.error('Failed to fetch building data from /api/building:', err);
    }
  };

  const handleSelectAddress = async (suggestion: any) => {
    const weergavenaam = suggestion?.weergavenaam || 'Adres';
    setSearchedAddress(weergavenaam);

    setIsLoadingAddress(true);
    try {
      const res = await fetch(
        `https://api.pdok.nl/bzk/locatieserver/v3_1/lookup?id=${suggestion.id}`
      );
      if (res.ok) {
        const data = await res.json();
        const doc = data?.response?.docs?.[0];
        if (doc) {
          let lat = currentCoords.lat;
          let lng = currentCoords.lng;
          if (doc.centroide_ll) {
            const match = doc.centroide_ll.match(/POINT\(([\d.]+)\s+([\d.]+)\)/);
            if (match) {
              lng = parseFloat(match[1]);
              lat = parseFloat(match[2]);
            }
          }
          const pandId = doc.pand_id || (doc.gekoppeld_pand && doc.gekoppeld_pand[0]);
          setCurrentCoords({ lat, lng });
          if (pandId) {
            setCurrentPandId(pandId);
          }
          await fetchBuildingDetails(pandId, lat, lng);
        }
      }
    } catch (err) {
      console.error('Failed to resolve address details:', err);
    } finally {
      setIsLoadingAddress(false);
    }
  };

  const handleSelectSampleAddress = (address: string) => {
    handleSelectAddress({
      id: 'sample-lookup',
      weergavenaam: address,
      type: 'adres',
      score: 1,
    });
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950 flex relative text-slate-100">
      {/* Floating PlaceSidebar left */}
      <PlaceSidebar
        isOpen={isSidebarOpen}
        onToggleOpen={() => setIsSidebarOpen(!isSidebarOpen)}
        activeView={activeView}
        onSelectView={setActiveView}
        searchedAddress={searchedAddress}
        onSelectAddress={handleSelectAddress}
        isLoadingAddress={isLoadingAddress}
        buildingData={currentBuildingData}
      />

      {/* Main Full-Bleed Viewer Canvas right */}
      <ViewerCanvas
        activeView={activeView}
        isSidebarOpen={isSidebarOpen}
        currentBuildingData={currentBuildingData}
        searchedAddress={searchedAddress}
        currentCoords={currentCoords}
        onSelectCoords={(coords) => {
          setCurrentCoords(coords);
          fetchBuildingDetails(undefined, coords.lat, coords.lng);
        }}
        onSelectSampleAddress={handleSelectSampleAddress}
      />
    </div>
  );
}
