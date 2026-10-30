import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { agentApi, clinicalApi } from '../../services/api';
import { HospitalFacility } from '../../types';
import { CameraCapture } from '../../components/CameraCapture';
import { MapView } from '../../components/MapView';
import { Send, Camera, Bot, User, Sparkles, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';

interface Message {
  sender: 'user' | 'agent';
  text: string;
  image?: string;
  timestamp: string;
  hospitals?: HospitalFacility[];
}

export const PatientChat: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'agent',
      text: `Hello ${user?.full_name || 'there'}! I am MedAgent, your clinical medication assistant. How can I help you today? You can ask me about medication dosage, side effects, what to do if you missed a dose, or use the camera button to scan a new prescription.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'camera') {
      setShowCamera(true);
    }
  }, [location]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (customText?: string, customImage?: string) => {
    const textToSend = customText !== undefined ? customText : input;
    if (!textToSend.trim() && !customImage) return;

    const userMsg: Message = {
      sender: 'user',
      text: textToSend,
      image: customImage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (customText === undefined) setInput('');
    setLoading(true);

    try {
      const data = await agentApi.chat(
        textToSend || 'Please analyze this scanned prescription image.',
        `session_${user?.id || 'default'}`,
        customImage,
        user
      );

      // If the message contains emergency keywords or indicates hospital triage, fetch hospitals
      let hospitals: HospitalFacility[] | undefined;
      if (
        data.output.toLowerCase().includes('emergency') ||
        data.output.toLowerCase().includes('hospital') ||
        textToSend.toLowerCase().includes('chest pain')
      ) {
        try {
          const hospData = await clinicalApi.getNearbyHospitals();
          hospitals = hospData.hospitals;
        } catch (e) {
          console.error(e);
        }
      }

      const agentMsg: Message = {
        sender: 'agent',
        text: data.output,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        hospitals,
      };

      setMessages((prev) => [...prev, agentMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'agent',
          text: 'I encountered a brief issue connecting to the inference engine. Please check your network and try again.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCameraCapture = (base64Image: string) => {
    handleSend('Please analyze this prescription photograph and extract all medication details.', base64Image);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 h-[calc(100vh-5rem)] flex flex-col">
      {/* Agent Banner */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm mb-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-gradient-to-tr from-sky-600 to-primary-600 text-white rounded-xl shadow-md">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-bold text-slate-900 text-sm">MedAgent Clinical Assistant</h2>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                Online
              </span>
            </div>
            <p className="text-xs text-slate-500">Prescription intake, drug interactions & emergency facility routing</p>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex items-start space-x-3 ${m.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                m.sender === 'user' ? 'bg-primary-600 text-white' : 'bg-sky-100 text-sky-700'
              }`}
            >
              {m.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div className={`max-w-[85%] sm:max-w-[75%] space-y-2`}>
              <div
                className={`p-4 rounded-2xl text-sm leading-relaxed ${
                  m.sender === 'user'
                    ? 'bg-primary-600 text-white rounded-tr-none shadow-sm'
                    : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none shadow-sm whitespace-pre-wrap'
                }`}
              >
                {m.image && (
                  <div className="mb-3 rounded-xl overflow-hidden border border-white/20">
                    <img src={m.image} alt="Prescription Upload" className="max-h-60 w-auto object-cover rounded-lg" />
                  </div>
                )}
                {m.text}
              </div>

              {m.hospitals && m.hospitals.length > 0 && (
                <div className="mt-3">
                  <MapView hospitals={m.hospitals} />
                </div>
              )}

              <span className={`block text-[10px] text-slate-400 ${m.sender === 'user' ? 'text-right' : 'text-left'}`}>
                {m.timestamp}
              </span>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center space-x-3 text-slate-400 text-xs py-2">
            <div className="w-8 h-8 rounded-full bg-sky-50 flex items-center justify-center text-sky-600 animate-spin">
              <RefreshCw className="w-4 h-4" />
            </div>
            <span>MedAgent is checking clinical guidelines and analyzing request...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div className="py-2 flex items-center space-x-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => handleSend('What should I do if I missed my morning Metformin dose?')}
          className="text-xs px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:border-primary-400 whitespace-nowrap transition"
        >
          Missed Dose Protocol
        </button>
        <button
          onClick={() => handleSend('Can I drink grapefruit juice with my Atorvastatin medication?')}
          className="text-xs px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:border-primary-400 whitespace-nowrap transition"
        >
          Food Interaction Check
        </button>
        <button
          onClick={() => handleSend('I have acute crushing chest pain, what should I do?')}
          className="text-xs px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 whitespace-nowrap transition font-semibold"
        >
          Emergency Triage Test
        </button>
      </div>

      {/* Input Form */}
      <div className="pt-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center space-x-2 bg-white rounded-2xl p-2 border border-slate-200 shadow-md"
        >
          <button
            type="button"
            onClick={() => setShowCamera(true)}
            className="p-2.5 text-slate-500 hover:text-primary-600 hover:bg-slate-100 rounded-xl transition"
            title="Scan Prescription Camera"
          >
            <Camera className="w-5 h-5" />
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type medication question or symptoms..."
            className="flex-1 px-3 py-2 text-sm focus:outline-none"
          />

          <button
            type="submit"
            disabled={!input.trim()}
            className="p-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-200 text-white rounded-xl transition shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Camera Modal */}
      {showCamera && (
        <CameraCapture onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />
      )}
    </div>
  );
};

