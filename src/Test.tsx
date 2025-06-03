import {Camera} from "lucide-react";
import QrScanner from "qr-scanner";
import React, {useState} from "react";


export default function TestApp() {
    const [scanning, setScanning] = useState(false);
    const videoRef = React.useRef(null);
    let qrScanner: QrScanner | null = null;

    const handleScanClick = async () => {
        setScanning(true);
        if (videoRef.current) {
            qrScanner = new QrScanner(
                videoRef.current,
                result => {
                    alert(`QR Code scanné : ${result}`);
                    // @ts-ignore
                    qrScanner.stop();
                    setScanning(false);
                },
                {
                    returnDetailedScanResult: true,
                }
            );
            qrScanner.start();
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 space-y-4">
            <h1 className="text-3xl font-bold">Bienvenue</h1>
            <p className="text-lg text-gray-600">essaye</p>

            <button onClick={handleScanClick} className="text-white bg-blue-600 hover:bg-blue-700">
                Scan
            </button>

            <button className="text-white bg-gray-600 hover:bg-gray-700">Attente</button>

            {scanning && (
                <video ref={videoRef} className="w-full max-w-md mt-4 border rounded-lg" autoPlay />
            )}
        </div>
    );
}
