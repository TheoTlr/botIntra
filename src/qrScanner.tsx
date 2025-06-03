import React, { useEffect, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "./lib/supabaseClient";

export default function QRScannerApp() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [scanner, setScanner] = useState<Html5Qrcode | null>(null);

    supabase
        .channel("realtime:code")
        .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "code" },
            (payload) => {
                console.log("Nouveau code:", payload);
            })

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        setLoading(true);
        const { data, error } = await supabase.from("code").select("code");

        if (error) {
            console.error("Erreur Supabase:", error);
        } else {
            console.log(data);
            setData(data);
        }
        setLoading(false);
    }

    const handleScanClick = async () => {
        if (scanning) return;

        const html5QrCode = new Html5Qrcode("reader");

        try {
            await html5QrCode.start(
                { facingMode: "environment" },
                {
                    fps: 10,
                    qrbox: 250,
                },
                (decodedText, decodedResult) => {
                    alert(`QR Code scanné : ${decodedText}`);
                    html5QrCode.stop().then(() => {
                        setScanning(false);
                        document.getElementById("reader")!.innerHTML = "";
                    });
                },
                (errorMessage) => {
                    console.warn("Erreur scan:", errorMessage);
                }
            );
            setScanner(html5QrCode);
            setScanning(true);
        } catch (err) {
            console.error("Erreur démarrage scanner :", err);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 space-y-4">
            <h2 className="text-xl font-semibold mb-2">Données récupérées :</h2>

            {loading ? (
                <p>Chargement...</p>
            ) : data.length === 0 ? (
                <p>Aucune donnée trouvée.</p>
            ) : (
                <ul className="list-disc list-inside space-y-1">
                    {data.map((item, index) => (
                        <li key={index}>{JSON.stringify(item)}</li>
                    ))}
                </ul>
            )}

            <button
                onClick={handleScanClick}
                className="text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
            >
                Scan
            </button>

            <button className="text-white bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded">
                Attente
            </button>

            <div id="reader" className="w-full max-w-md mt-4 border rounded-lg" />
        </div>
    );
}
