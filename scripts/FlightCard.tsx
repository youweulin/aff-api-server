import React from 'react';
import { Plane, Clock, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { FLIGHTS } from '../constants';
import { AIUsageContext } from '../hooks/useAIUsage';
import { Flight } from '../types';

interface FlightCardProps {
  flights?: Flight[];
  onUpdate?: (updatedFlights: Flight[]) => void;
  aiUsage?: AIUsageContext;
  showBookingLinks?: boolean;
  readOnly?: boolean;
}

const FlightCard: React.FC<FlightCardProps> = ({ flights = FLIGHTS, onUpdate, aiUsage, showBookingLinks = true, readOnly = false }) => {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedFlights, setEditedFlights] = React.useState<Flight[]>(flights);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setEditedFlights(flights);
  }, [flights]);

  const handleSave = () => {
    if (onUpdate) {
      onUpdate(editedFlights);
    }
    setIsEditing(false);
  };
  // ... (omitting middle parts for brevity in tool call if possible, but replace_file_content needs exact blocks. I will do 2 chunks.)

  // Chunk 1: Interface and Destructuring
  // Chunk 2: Button rendering


  const handleFlightChange = (index: number, field: keyof Flight, value: string) => {
    const newFlights = [...editedFlights];
    newFlights[index] = { ...newFlights[index], [field]: value };
    setEditedFlights(newFlights);
  };

  const handleAiScan = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Fallback Logic Strategy:
    // 1. Try gemini-2.5-flash
    // 2. If Limit or Error -> Try gemini-3-flash-preview
    let activeModel: 'gemini-2.5-flash' | 'gemini-3.0-flash' = 'gemini-2.5-flash';
    let serviceModelName = 'gemini-2.5-flash';

    // Check 2.5 Limit first
    if (aiUsage && !aiUsage.checkLimit('gemini-2.5-flash')) {
      activeModel = 'gemini-3.0-flash';
      serviceModelName = 'gemini-3-flash-preview';
      if (aiUsage && !aiUsage.checkLimit('gemini-3.0-flash')) {
        alert('⚠️ 所有模型的每日額度已用完 (All Limits Reached). 請明天再試。');
        return;
      }
    }

    setIsAnalyzing(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];

        const { analyzeFlightTicket } = await import('./TourLens/services/geminiService');

        // internal helper to attempt call
        const performScan = async (modelId: string, usageKey: 'gemini-2.5-flash' | 'gemini-3.0-flash') => {
          const result = await analyzeFlightTicket(base64Data, modelId, aiUsage?.userApiKey);
          if (!result || !Array.isArray(result) || result.length === 0) throw new Error("No data");
          return result;
        }

        let analyzedFlights;
        try {
          // Attempt 1
          analyzedFlights = await performScan(serviceModelName, activeModel);
          if (aiUsage) aiUsage.incrementUsage(activeModel);
        } catch (err) {
          console.warn(`Model ${activeModel} failed, trying fallback if available.`, err);
          // If we were on 2.5, try 3.0
          if (activeModel === 'gemini-2.5-flash') {
            if (aiUsage && aiUsage.checkLimit('gemini-3.0-flash')) {
              activeModel = 'gemini-3.0-flash';
              serviceModelName = 'gemini-3-flash-preview';
              analyzedFlights = await performScan(serviceModelName, activeModel);
              if (aiUsage) aiUsage.incrementUsage(activeModel);
            } else {
              throw new Error("All limits reached during fallback");
            }
          } else {
            throw err; // If 3.0 also failed, re-throw
          }
        }

        if (analyzedFlights) {
          setEditedFlights(analyzedFlights);
          alert('AI Analysis Complete! Flight details updated.');
        } else {
          alert('Could not identify flight details. Please try another image.');
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error(error);
      alert('AI Analysis Failed.');
    } finally {
      setIsAnalyzing(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const extractIata = (text: string) => {
    const match = text.match(/\(([A-Z]{3})\)/);
    if (match) return match[1];
    return text.trim();
  };

  const getSkyscannerLink = (currentFlight: Flight) => {
    try {
      const outboundFlight = flights[0];
      const returnFlight = flights.length > 1 ? flights[flights.length - 1] : null;

      if (!outboundFlight) return `https://www.skyscanner.com.tw/transport/flights`;

      const routeParts = outboundFlight.route.includes('→') ? outboundFlight.route.split('→') : outboundFlight.route.split('->');
      const originRaw = routeParts[0]?.trim() || '';
      const destRaw = routeParts[1]?.trim() || '';

      const origin = extractIata(originRaw);
      const dest = extractIata(destRaw);

      if (!origin || !dest) return `https://www.skyscanner.com.tw/transport/flights`;

      let url = `https://www.skyscanner.com.tw/transport/flights?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}&outboundDate=${outboundFlight.date}`;

      if (returnFlight) {
        url += `&inboundDate=${returnFlight.date}`;
      }

      return url;
    } catch (e) {
      return `https://www.skyscanner.com.tw/transport/flights`;
    }
  };

  const getExpediaLink = (currentFlight: Flight) => {
    try {
      const AFFILIATE_ID = '1100l5zpRT';

      const outboundFlight = flights[0];
      const returnFlight = flights.length > 1 ? flights[flights.length - 1] : null;

      if (!outboundFlight) return `https://www.expedia.com.tw/Flights`;

      const depDate = outboundFlight.date.replace(/-/g, '/');

      const routeParts = outboundFlight.route.includes('→') ? outboundFlight.route.split('→') : outboundFlight.route.split('->');
      const originRaw = routeParts[0]?.trim() || '';
      const destRaw = routeParts[1]?.trim() || '';

      const origin = extractIata(originRaw);
      const dest = extractIata(destRaw);

      if (!origin || !dest) return `https://www.expedia.com.tw/Flights`;

      // Base URL for Leg 1
      let url = `https://www.expedia.com.tw/Flights-Search?leg1=from:${encodeURIComponent(origin)},to:${encodeURIComponent(dest)},departure:${depDate}TANYT`;

      // Add Leg 2 if Round Trip
      if (returnFlight) {
        const retDate = returnFlight.date.replace(/-/g, '/');
        url += `&leg2=from:${encodeURIComponent(dest)},to:${encodeURIComponent(origin)},departure:${retDate}TANYT&mode=search&trip=roundtrip`;
      } else {
        url += `&mode=search&trip=oneway`;
      }

      if (AFFILIATE_ID) {
        url += `&camref=${AFFILIATE_ID}`;
      }

      return url;
    } catch (e) {
      return `https://www.expedia.com.tw/Flights`;
    }
  };

  return (
    <section className="max-w-4xl mx-auto px-4 -mt-20 relative z-10 mb-16">
      <div className="bg-white shadow-xl rounded-2xl p-6 md:p-8 border border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h3
            className="text-xl font-bold text-gray-800 flex items-center gap-2 serif cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <Plane className="w-6 h-6 text-red-800" />
            航班資訊
            {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </h3>
          <div className="flex gap-2">
            {isExpanded && isEditing && (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleAiScan}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isAnalyzing}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-1 ${isAnalyzing
                    ? 'bg-gray-200 text-gray-500 cursor-wait'
                    : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                    }`}
                >
                  {isAnalyzing ? 'Analyzing...' : 'AI Scan (辨識)'}
                </button>
              </>
            )}
            {isExpanded && !readOnly && (
              <button
                onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${isEditing
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                {isEditing ? '儲存變更 (Save)' : '編輯航班 (Edit)'}
              </button>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="grid md:grid-cols-2 gap-8">
            {(isEditing ? editedFlights : flights).map((flight, idx) => (
              <div key={idx} className="bg-gray-50 rounded-xl p-5 border border-gray-200 hover:border-red-800/30 transition-colors">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <span className="bg-red-800 text-white text-xs px-2 py-1 rounded">
                      {idx === 0 ? '去程' : '回程'}
                    </span>
                    {isEditing ? (
                      <input
                        type="text"
                        value={flight.airline}
                        onChange={(e) => handleFlightChange(idx, 'airline', e.target.value)}
                        className="border rounded px-2 py-1 text-xs w-24"
                        placeholder="Airline"
                      />
                    ) : (
                      <span className="text-sm font-bold text-gray-700">{flight.airline}</span>
                    )}
                  </div>

                  {isEditing ? (
                    <input
                      type="date"
                      value={flight.date}
                      onChange={(e) => handleFlightChange(idx, 'date', e.target.value)}
                      className="border rounded px-2 py-1 text-xs"
                    />
                  ) : (
                    <span className="text-lg font-mono font-bold text-gray-600 tracking-wide">{flight.date}</span>
                  )}
                </div>

                <div className="flex items-center justify-between mb-4">
                  <div className="text-center">
                    {isEditing ? (
                      <div className="flex flex-col gap-1">
                        <input
                          type="text"
                          placeholder="Time (HH:MM)"
                          value={(flight.time.includes('→') ? flight.time.split('→')[0] : flight.time.split('->')[0] || flight.time).trim()}
                          onChange={(e) => {
                            const parts = flight.time.includes('→') ? flight.time.split('→') : flight.time.split('->');
                            const destTime = parts[1] || '';
                            handleFlightChange(idx, 'time', `${e.target.value} -> ${destTime}`);
                          }}
                          className="border rounded px-2 py-1 text-sm w-20 text-center"
                        />
                        <input
                          type="text"
                          placeholder="Origin"
                          value={(flight.route.includes('→') ? flight.route.split('→')[0] : flight.route.split('->')[0] || flight.route).trim()}
                          onChange={(e) => {
                            const parts = flight.route.includes('→') ? flight.route.split('→') : flight.route.split('->');
                            const destRoute = parts[1] || '';
                            handleFlightChange(idx, 'route', `${e.target.value} -> ${destRoute}`);
                          }}
                          className="border rounded px-2 py-1 text-xs w-16 text-center"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="text-2xl font-bold text-gray-900">
                          {(flight.time.includes('→') ? flight.time.split('→')[0] : flight.time.split('->')[0] || flight.time).trim()}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {(flight.route.includes('→') ? flight.route.split('→')[0] : flight.route.split('->')[0] || flight.route).trim()}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex flex-col items-center px-4 flex-1">
                    {isEditing ? (
                      <>
                        <input
                          type="text"
                          placeholder="Duration"
                          value={flight.duration}
                          onChange={(e) => handleFlightChange(idx, 'duration', e.target.value)}
                          className="border rounded px-2 py-0.5 text-xs w-16 mb-1 text-center"
                        />
                        <div className="w-full h-px bg-gray-300 relative my-1">
                          <Plane className="w-4 h-4 text-gray-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rotate-90" />
                        </div>
                        <input
                          type="text"
                          placeholder="Flight No"
                          value={flight.flightNumber}
                          onChange={(e) => handleFlightChange(idx, 'flightNumber', e.target.value)}
                          className="border rounded px-2 py-0.5 text-xs w-16 mt-1 text-center font-bold text-red-800"
                        />
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-gray-400 mb-1">{flight.duration}</span>
                        <div className="w-full h-px bg-gray-300 relative">
                          <Plane className="w-4 h-4 text-gray-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rotate-90" />
                        </div>
                        <span className="text-xs text-red-800 font-bold mt-1">{flight.flightNumber}</span>
                      </>
                    )}
                  </div>

                  <div className="text-center">
                    {isEditing ? (
                      <div className="flex flex-col gap-1">
                        <input
                          type="text"
                          placeholder="Time (HH:MM)"
                          value={(flight.time.includes('→') ? flight.time.split('→')[1] : flight.time.split('->')[1] || '').trim()}
                          onChange={(e) => {
                            const parts = flight.time.includes('→') ? flight.time.split('→') : flight.time.split('->');
                            const originTime = parts[0] || '';
                            handleFlightChange(idx, 'time', `${originTime} -> ${e.target.value}`);
                          }}
                          className="border rounded px-2 py-1 text-sm w-20 text-center"
                        />
                        <input
                          type="text"
                          placeholder="Dest"
                          value={(flight.route.includes('→') ? flight.route.split('→')[1] : flight.route.split('->')[1] || '').trim()}
                          onChange={(e) => {
                            const parts = flight.route.includes('→') ? flight.route.split('→') : flight.route.split('->');
                            const originRoute = parts[0] || '';
                            handleFlightChange(idx, 'route', `${originRoute} -> ${e.target.value}`);
                          }}
                          className="border rounded px-2 py-1 text-xs w-16 text-center"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="text-2xl font-bold text-gray-900">
                          {(flight.time.includes('→') ? flight.time.split('→')[1] : flight.time.split('->')[1] || '').trim()}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {(flight.route.includes('→') ? flight.route.split('→')[1] : flight.route.split('->')[1] || '').trim()}
                        </div>
                      </>
                    )}
                  </div>
                </div>



                {!isEditing && showBookingLinks && (
                  <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
                    <a
                      href={getExpediaLink(flight)}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-camref="1100l5zpRT"
                      className="flex-1 bg-[#ffdb00] text-blue-900 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-[#e6c500] transition-colors"
                    >
                      Expedia
                    </a>
                    <a
                      href={getSkyscannerLink(flight)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-[#0092d0] text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-[#007ba8] transition-colors"
                    >
                      Skyscanner
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default FlightCard;