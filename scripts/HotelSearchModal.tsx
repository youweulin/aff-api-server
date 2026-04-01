import React, { useState, useEffect } from 'react';
import { searchAgodaHotels, AgodaHotel } from '../services/agodaService';
import { X, Search, Star, MapPin, ExternalLink, Hotel, Loader2, Plane, Ticket } from 'lucide-react';

interface HotelSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialSearchTerm?: string;
    tripDate?: string; // 行程日期 YYYY-MM-DD
}

const HotelSearchModal: React.FC<HotelSearchModalProps> = ({ isOpen, onClose, initialSearchTerm = '', tripDate }) => {
    const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
    const [results, setResults] = useState<AgodaHotel[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [activeTab, setActiveTab] = useState<'agoda' | 'expedia' | 'hotels' | 'klook'>('agoda');

    // Auto-search on open
    useEffect(() => {
        if (isOpen && initialSearchTerm) {
            setSearchTerm(initialSearchTerm);
            handleSearch(initialSearchTerm);
        } else {
            if (!isOpen) {
                setResults([]);
                setHasSearched(false);
                setActiveTab('agoda');
            }
        }
    }, [isOpen, initialSearchTerm]);

    // Load External Widget Scripts
    useEffect(() => {
        if (!isOpen) return;

        // Expedia Script
        const expScript = document.createElement('script');
        expScript.className = 'eg-widgets-script';
        expScript.src = 'https://creator.expediagroup.com/products/widgets/assets/eg-widgets.js';
        expScript.async = true;
        document.body.appendChild(expScript);

        // Klook Script
        const klookScript = document.createElement('script');
        klookScript.src = 'https://affiliate.klook.com/widget/fetch-iframe-init.js';
        klookScript.async = true;
        document.body.appendChild(klookScript);

        return () => {
            // Cleanup strictly not required as scripts handle themselves, but good practice to check
        };
    }, [isOpen]);

    const handleSearch = async (term: string) => {
        if (!term.trim()) return;
        setLoading(true);
        setHasSearched(true);
        try {
            const data = await searchAgodaHotels(term, tripDate);
            setResults(data);
        } catch (error) {
            console.error(error);
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">

                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-900 to-indigo-900 text-white">
                    <div className="flex items-center gap-2">
                        <Hotel className="w-5 h-5" />
                        <h3 className="font-bold text-lg">全網比價搜尋</h3>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="p-4 bg-gray-50 border-b border-gray-200">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSearch(searchTerm);
                        }}
                        className="flex gap-2"
                    >
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="輸入目的地或飯店名稱..."
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                                autoFocus
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-70 flex items-center gap-2 shadow-lg shadow-blue-200"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '搜尋全網'}
                        </button>
                    </form>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100">
                    <button
                        onClick={() => setActiveTab('hotels')}
                        className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1 border-b-2 transition-all ${activeTab === 'hotels' ? 'border-red-500 text-red-600 bg-red-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <Hotel className="w-3 h-3" /> Hotels.com
                    </button>
                    <button
                        onClick={() => setActiveTab('agoda')}
                        className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1 border-b-2 transition-all ${activeTab === 'agoda' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <Hotel className="w-3 h-3" /> Agoda
                    </button>
                    <button
                        onClick={() => setActiveTab('expedia')}
                        className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1 border-b-2 transition-all ${activeTab === 'expedia' ? 'border-yellow-500 text-yellow-600 bg-yellow-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <Plane className="w-3 h-3" /> Expedia
                    </button>
                    <button
                        onClick={() => setActiveTab('klook')}
                        className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1 border-b-2 transition-all ${activeTab === 'klook' ? 'border-orange-500 text-orange-600 bg-orange-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <Ticket className="w-3 h-3" /> Klook
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto bg-gray-50 p-4">

                    {/* Agoda View */}
                    <div className={activeTab === 'agoda' ? 'space-y-4' : 'hidden'}>
                        {loading ? (
                            <div className="text-center py-12 text-gray-400">
                                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
                                <p>正在搜尋 Agoda 最優惠價格...</p>
                            </div>
                        ) : results.length > 0 ? (
                            results.map((hotel) => (
                                <div key={hotel.hotelId} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex gap-4 hover:shadow-md transition-all group">
                                    <div className="w-28 h-28 bg-gray-200 rounded-lg overflow-hidden shrink-0">
                                        <img src={hotel.image} alt={hotel.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                    </div>
                                    <div className="flex-1 flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-start">
                                                <h4 className="font-bold text-gray-800 line-clamp-2 text-lg">{hotel.name}</h4>
                                                <div className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-1 rounded flex items-center gap-1 shrink-0">
                                                    <Star className="w-3 h-3 fill-blue-700" />
                                                    {hotel.rating}
                                                </div>
                                            </div>
                                            <p className="text-gray-500 text-xs mt-1 flex items-center gap-1">
                                                <MapPin className="w-3 h-3" /> {hotel.address}
                                            </p>
                                        </div>
                                        <div className="flex items-end justify-between mt-2">
                                            <div>
                                                <span className="text-2xl font-bold text-rose-600 font-sans">
                                                    {hotel.currency === 'TWD' ? 'NT$' : ''}{hotel.price.toLocaleString()}
                                                </span>
                                                <span className="text-xs text-gray-400 ml-1">起</span>
                                            </div>
                                            <a
                                                href={hotel.landingURL}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center gap-1"
                                            >
                                                查看優惠 <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-12 text-gray-400">
                                <Hotel className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>請輸入目的地搜尋 Agoda 優惠</p>
                            </div>
                        )}
                    </div>

                    {/* Expedia View */}
                    <div className={activeTab === 'expedia' ? 'space-y-6' : 'hidden'}>
                        <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl p-6 text-white text-center shadow-lg">
                            <h4 className="text-xl font-bold mb-2">Expedia 智遊網</h4>
                            <p className="opacity-90 mb-4">搜尋 "{searchTerm || '目的地'}" 的機票與飯店優惠</p>
                            <a
                                href={`https://www.expedia.com.tw/Hotel-Search?destination=${encodeURIComponent(searchTerm)}&affcid=tw.network.affiliate.cj.1100l5zpRT`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 bg-white text-orange-600 px-6 py-3 rounded-full font-bold shadow-md hover:bg-orange-50 transition-colors"
                            >
                                前往 Expedia 查看價格 <ExternalLink className="w-4 h-4" />
                            </a>
                        </div>

                        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                            <p className="text-xs text-center text-gray-400 mb-4">- 或使用搜尋小工具 -</p>
                            <div className="flex justify-center">
                                <div
                                    className="eg-widget"
                                    data-widget="search"
                                    data-program="us-expedia"
                                    data-lobs="stays,flights"
                                    data-network="pz"
                                    data-camref="1100l5zpRT"
                                    data-pubref=""
                                ></div>
                            </div>
                        </div>
                    </div>

                    {/* Hotels.com View */}
                    <div className={activeTab === 'hotels' ? 'space-y-6' : 'hidden'}>
                        <div className="bg-gradient-to-br from-red-500 to-pink-600 rounded-xl p-6 text-white text-center shadow-lg">
                            <h4 className="text-xl font-bold mb-2">Hotels.com</h4>
                            <p className="opacity-90 mb-4">搜尋 "{searchTerm || '目的地'}" 的飯店優惠</p>
                            <a
                                href={`https://tw.hotels.com/Hotel-Search?destination=${encodeURIComponent(searchTerm)}&affcid=tw.network.affiliate.cj.1100l5zpRT`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 bg-white text-red-600 px-6 py-3 rounded-full font-bold shadow-md hover:bg-red-50 transition-colors"
                            >
                                前往 Hotels.com 查看價格 <ExternalLink className="w-4 h-4" />
                            </a>
                        </div>

                        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                            <p className="text-xs text-center text-gray-400 mb-4">- Hotels.com 搜尋小工具 -</p>
                            <div className="flex justify-center">
                                <div
                                    className="eg-widget"
                                    data-widget="search"
                                    data-program="us-hotels"
                                    data-lobs="stays"
                                    data-network="pz"
                                    data-camref="1100l5zpRT"
                                    data-pubref=""
                                ></div>
                            </div>
                        </div>
                    </div>

                    {/* Klook View */}
                    <div className={activeTab === 'klook' ? 'space-y-6 text-center' : 'hidden'}>
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 overflow-hidden">
                            <ins
                                className="klk-aff-widget"
                                data-wid="30600"
                                data-height="450px"
                                data-adid="1175720"
                                data-lang="zh-TW"
                                data-prod="search_vertical"
                                data-currency="TWD"
                            >
                                <a href="//www.klook.com/?aid=30600">Klook.com</a>
                            </ins>
                        </div>
                        <p className="text-xs text-gray-400">
                            搜尋當地體驗、門票與交通券
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HotelSearchModal;
