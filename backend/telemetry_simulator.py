import random

PHASES = [
    {"name": "Idle", "duration": 40, "sm": (2, 8), "mem": (5, 12), "pcie": "L1"},
    {"name": "Desktop", "duration": 20, "sm": (10, 25), "mem": (15, 30), "pcie": "L0"},
    {"name": "Game Load", "duration": 30, "sm": (40, 70), "mem": (50, 80), "pcie": "L0"},
    {"name": "Gaming", "duration": 80, "sm": (75, 95), "mem": (80, 95), "pcie": "L0"},
    {"name": "Cutscene", "duration": 30, "sm": (30, 50), "mem": (40, 60), "pcie": "L0"},
    {"name": "Gaming", "duration": 60, "sm": (75, 95), "mem": (80, 95), "pcie": "L0"},
    {"name": "Menu", "duration": 20, "sm": (10, 20), "mem": (15, 25), "pcie": "L0"},
]

class TelemetrySimulator:
    def __init__(self):
        self.tick = 0
        self.phase_idx = 0
        self.phase_tick = 0
        self.time_s = 0.0

    def get_real_power(self, sm, mem):
        # A rough heuristic for actual power based on Arc behavior
        base = 38 # high idle
        return base + (sm * 1.2) + (mem * 0.8) + random.uniform(-3, 3)

    def next_point(self):
        phase = PHASES[self.phase_idx]
        self.phase_tick += 1
        if self.phase_tick >= phase["duration"]:
            self.phase_tick = 0
            self.phase_idx = (self.phase_idx + 1) % len(PHASES)
            phase = PHASES[self.phase_idx]

        self.tick += 1
        self.time_s += 0.2 # 5 ticks per sec
        
        sm = random.uniform(*phase["sm"])
        mem = random.uniform(*phase["mem"])
        power = self.get_real_power(sm, mem)
        
        return {
            "time": f"{self.time_s:.1f}s",
            "sm": round(sm, 1),
            "mem": round(mem, 1),
            "pcie": phase["pcie"],
            "actual_power": round(power, 1),
            "raw_phase": phase["name"] # Ground truth, but AI has to guess it
        }
