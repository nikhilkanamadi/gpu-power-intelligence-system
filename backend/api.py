import asyncio
import json
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from telemetry_simulator import TelemetrySimulator
from ml_models import AI_Pipeline

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

simulator = TelemetrySimulator()
ai_pipeline = AI_Pipeline()

async def event_stream():
    """Generates SSE events combining raw telemetry + AI predictions."""
    while True:
        # Get raw data from the system (simulated VTune/GPU sensors)
        raw_telemetry = simulator.next_point()
        
        # Process through our "AI Driver" layer
        ai_results = ai_pipeline.process(raw_telemetry)
        
        # Combine and send to frontend
        payload = {
            **raw_telemetry,
            **ai_results
        }
        
        yield f"data: {json.dumps(payload)}\n\n"
        await asyncio.sleep(0.2) # Real-time tick rate (5Hz)

@app.get("/stream")
async def stream():
    return StreamingResponse(event_stream(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
