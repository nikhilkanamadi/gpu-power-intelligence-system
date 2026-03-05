import random

class PhaseClassifier:
    """
    Simulates a Gradient Boosting model to classify the workload phase based on telemetry.
    """
    def __init__(self):
        pass

    def predict(self, telemetry):
        sm = telemetry["sm"]
        mem = telemetry["mem"]
        
        # Simulated logic of an ML model determining the state
        mwp_cwp_ratio = mem / max(sm, 1.0)
        
        if sm < 10 and mem < 15:
            return "Idle"
        elif sm < 30 and mem < 40:
            return "Desktop"
        elif sm < 60 and mem < 70:
            return "Cutscene"
        else:
            if mwp_cwp_ratio > 1.2:
                return "Game Load"
            return "Gaming"

class PowerPredictor:
    """
    Simulates an LSTM model predicting the optimal DVFS power state.
    """
    def __init__(self):
        pass

    def predict_optimal(self, telemetry, classified_phase):
        sm = telemetry["sm"]
        mem = telemetry["mem"]
        actual_power = telemetry["actual_power"]

        # Calculate "optimal" power. The AI trims the dead weight.
        # Arc high idle is 38W. Optimal idle is ~12W.
        # Savings are also found in gaming when MWP > CWP (waiting on memory)
        
        base_optimal = 10
        if classified_phase == "Idle":
            optimal = base_optimal + random.uniform(0, 4)
        elif classified_phase == "Desktop":
            optimal = 18 + (sm * 0.5) + (mem * 0.2)
        elif classified_phase == "Cutscene":
            optimal = 60 + (sm * 0.8) + (mem * 0.5)
        elif classified_phase == "Game Load":
            optimal = 80 + (sm * 0.9) + (mem * 0.4)
        else:
            # Gaming
            mwp_cwp_ratio = mem / max(sm, 1.0)
            if mwp_cwp_ratio > 1.1:
                # Memory bound, can drop compute power safely
                optimal = actual_power - 35
            else:
                optimal = actual_power - 15
                
        # Never go below baseline optimal or above actual
        optimal = max(base_optimal, min(optimal, actual_power - 2))
        return round(optimal, 1)

class AI_Pipeline:
    def __init__(self):
        self.classifier = PhaseClassifier()
        self.predictor = PowerPredictor()
        
    def process(self, telemetry):
        # 1. Classify Phase
        predicted_phase = self.classifier.predict(telemetry)
        
        # 2. Predict Optimal Power
        optimal_power = self.predictor.predict_optimal(telemetry, predicted_phase)
        
        mwp_cwp_ratio = telemetry["mem"] / max(telemetry["sm"], 1.0)
        
        return {
            "predicted_phase": predicted_phase,
            "optimal_power": optimal_power,
            "savings": round(telemetry["actual_power"] - optimal_power, 1),
            "mwp_cwp_ratio": round(mwp_cwp_ratio, 2)
        }
