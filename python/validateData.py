import pandas as pd
import numpy as np
from scipy import stats, signal
import matplotlib.pyplot as plt
from typing import List, Dict, Tuple, Optional
import io
import os
from datetime import datetime
import json

class MotorControlValidator:
    def __init__(self, config_path: Optional[str] = None):
        """
        Initialize validator with configurable thresholds
        Args:
            config_path: Optional path to JSON config file with threshold values
        """
        # Default thresholds
        self.thresholds = {
            # Physiological thresholds
            'min_reaction_time': 100,      # ms
            'max_reaction_time': 1000,     # ms
            'min_movement_time': 200,      # ms
            'max_movement_time': 3000,     # ms
            'min_directness': 0.5,         # ratio
            'max_velocity': 4000,          # px/s
            
            # Quality thresholds
            'good_reaction_time': 150,     # ms
            'good_movement_time': 1500,    # ms
            'good_directness': 0.8,        # ratio
            'max_movement_units': 10,      # count
            'max_corrections': 5,          # count
            'sampling_rate': 10,           # ms
            'velocity_threshold': 50,      # px/s for movement initiation
            'stopping_threshold': 10,      # px/s for movement termination
            
            # Discount weights
            'reaction_time_weight': 0.3,
            'movement_time_weight': 0.3,
            'directness_weight': 0.2,
            'smoothness_weight': 0.1,
            'corrections_weight': 0.1
        }
        
        if config_path and os.path.exists(config_path):
            with open(config_path, 'r') as f:
                custom_thresholds = json.load(f)
                self.thresholds.update(custom_thresholds)

    def parse_movement_file(self, filepath: str) -> Tuple[pd.DataFrame, List[Dict]]:
        """
        Parse movement data file containing both summary metrics and raw trajectories
        """
        with open(filepath, 'r') as f:
            content = f.read()
        
        # Split into header and raw data sections
        sections = content.split('\nRaw Path Data:\n')
        header_section = sections[0]
        raw_data_section = sections[1] if len(sections) > 1 else ""
        
        # Parse summary data
        header_lines = header_section.split('\n')[2:]  # Skip participant info
        summary_data = pd.read_csv(io.StringIO('\n'.join(header_lines)))
        
        # Parse raw trajectory data
        trajectory_data = self._parse_raw_trajectories(raw_data_section)
        
        return summary_data, trajectory_data

    def _parse_raw_trajectories(self, raw_data: str) -> List[Dict]:
        """Parse raw trajectory data into list of trial dictionaries"""
        trials = []
        current_trial = None
        
        for line in raw_data.split('\n'):
            line = line.strip()
            if not line:
                continue
                
            if line.startswith('Trial'):
                if current_trial and current_trial['timestamps']:
                    trials.append(current_trial)
                trial_num = int(line.split()[1])
                current_trial = {
                    'trial_num': trial_num,
                    'timestamps': [],
                    'x_pos': [],
                    'y_pos': []
                }
            elif line.startswith('Time') or line.startswith('X') or line.startswith('Y'):
                continue
            elif ',' in line:
                try:
                    time, x, y = map(float, line.split(','))
                    current_trial['timestamps'].append(time)
                    current_trial['x_pos'].append(x)
                    current_trial['y_pos'].append(y)
                except (ValueError, IndexError):
                    continue
                    
        if current_trial and current_trial['timestamps']:
            trials.append(current_trial)
            
        return trials

    def calculate_trial_metrics(self, trial_data: Dict) -> Dict:
        """Calculate detailed metrics for a single trial"""
        timestamps = np.array(trial_data['timestamps'])
        positions = np.array(list(zip(trial_data['x_pos'], trial_data['y_pos'])))
        
        # Calculate velocities
        distances = np.sqrt(np.sum(np.diff(positions, axis=0)**2, axis=1))
        times = np.diff(timestamps) / 1000  # Convert to seconds
        velocities = np.concatenate(([0], distances / times))
        
        # Smooth velocities
        window = signal.windows.hann(5)
        smoothed_velocities = signal.convolve(velocities, window/window.sum(), mode='same')
        
        # Calculate accelerations
        accelerations = np.gradient(smoothed_velocities, timestamps/1000)
        
        # Find movement onset (first velocity > threshold)
        movement_onset = np.where(smoothed_velocities > self.thresholds['velocity_threshold'])[0]
        movement_onset = movement_onset[0] if len(movement_onset) > 0 else 0
        
        # Calculate path metrics
        total_distance = np.sum(distances)
        straight_line_distance = np.sqrt(np.sum((positions[-1] - positions[0])**2))
        directness = straight_line_distance / total_distance if total_distance > 0 else 0
        
        # Count movement units (velocity peaks)
        peaks, _ = signal.find_peaks(smoothed_velocities, height=self.thresholds['velocity_threshold'])
        
        # Count corrective movements (when acceleration changes sign)
        acc_sign_changes = np.where(np.diff(np.signbit(accelerations)))[0]
        
        return {
            'reaction_time': timestamps[movement_onset],
            'movement_time': timestamps[-1] - timestamps[movement_onset],
            'peak_velocity': np.max(smoothed_velocities),
            'time_to_peak_velocity': timestamps[np.argmax(smoothed_velocities)],
            'path_length': total_distance,
            'directness_ratio': directness,
            'movement_units': len(peaks),
            'corrective_movements': len(acc_sign_changes),
            'mean_velocity': np.mean(smoothed_velocities),
            'velocity_peaks': peaks,
            'velocities': smoothed_velocities,
            'accelerations': accelerations,
            'timestamps': timestamps
        }

    def validate_trial(self, trial_metrics: Dict) -> Tuple[bool, float, List[str]]:
        """Validate trial and calculate quality score"""
        is_valid = True
        discount_reasons = []
        quality_components = {}
        
        # Reaction Time Validation
        rt = trial_metrics['reaction_time']
        if rt < self.thresholds['min_reaction_time']:
            is_valid = False
            discount_reasons.append(f"Reaction time too fast: {rt:.1f}ms")
            quality_components['rt_score'] = 0
        elif rt > self.thresholds['max_reaction_time']:
            is_valid = False
            discount_reasons.append(f"Reaction time too slow: {rt:.1f}ms")
            quality_components['rt_score'] = 0
        else:
            rt_score = 1.0 - ((rt - self.thresholds['good_reaction_time']) / 
                             (self.thresholds['max_reaction_time'] - self.thresholds['good_reaction_time']))
            quality_components['rt_score'] = max(0, min(1, rt_score))
            
        # Movement Time Validation
        mt = trial_metrics['movement_time']
        if mt < self.thresholds['min_movement_time']:
            is_valid = False
            discount_reasons.append(f"Movement time too fast: {mt:.1f}ms")
            quality_components['mt_score'] = 0
        elif mt > self.thresholds['max_movement_time']:
            is_valid = False
            discount_reasons.append(f"Movement time too slow: {mt:.1f}ms")
            quality_components['mt_score'] = 0
        else:
            mt_score = 1.0 - ((mt - self.thresholds['good_movement_time']) /
                             (self.thresholds['max_movement_time'] - self.thresholds['good_movement_time']))
            quality_components['mt_score'] = max(0, min(1, mt_score))
            
        # Path Efficiency
        directness = trial_metrics['directness_ratio']
        if directness < self.thresholds['min_directness']:
            is_valid = False
            discount_reasons.append(f"Path too indirect: {directness:.3f}")
            quality_components['directness_score'] = 0
        else:
            directness_score = (directness - self.thresholds['min_directness']) / \
                             (self.thresholds['good_directness'] - self.thresholds['min_directness'])
            quality_components['directness_score'] = max(0, min(1, directness_score))
            
        # Movement Smoothness
        movement_units = trial_metrics['movement_units']
        if movement_units > self.thresholds['max_movement_units']:
            smoothness_score = max(0, 1 - (movement_units - self.thresholds['max_movement_units']) / 10)
            discount_reasons.append(f"Jerky movement: {movement_units} units")
        else:
            smoothness_score = 1.0
        quality_components['smoothness_score'] = smoothness_score
        
        # Calculate weighted quality score
        if is_valid:
            quality_score = (
                quality_components['rt_score'] * self.thresholds['reaction_time_weight'] +
                quality_components['mt_score'] * self.thresholds['movement_time_weight'] +
                quality_components['directness_score'] * self.thresholds['directness_weight'] +
                quality_components['smoothness_score'] * self.thresholds['smoothness_weight']
            )
        else:
            quality_score = 0.0
            
        return is_valid, quality_score, discount_reasons

    def analyze_session(self, filepath: str, output_dir: Optional[str] = None) -> Dict:
        """Analyze entire session and generate report"""
        summary_data, trajectory_data = self.parse_movement_file(filepath)
        results = {
            'participant_info': {
                'total_trials': len(summary_data),
                'valid_trials': 0,
                'high_quality_trials': 0,
                'mean_quality_score': 0.0
            },
            'trial_results': []
        }
        
        quality_scores = []
        
        # Analyze each trial
        for trial_data in trajectory_data:
            metrics = self.calculate_trial_metrics(trial_data)
            is_valid, quality_score, reasons = self.validate_trial(metrics)
            
            trial_result = {
                'trial_number': trial_data['trial_num'],
                'metrics': metrics,
                'is_valid': is_valid,
                'quality_score': quality_score,
                'issues': reasons
            }
            results['trial_results'].append(trial_result)
            
            if is_valid:
                results['participant_info']['valid_trials'] += 1
                quality_scores.append(quality_score)
                if quality_score >= 0.95:
                    results['participant_info']['high_quality_trials'] += 1
                    
        if quality_scores:
            results['participant_info']['mean_quality_score'] = np.mean(quality_scores)
            
        # Generate plots if output directory provided
        if output_dir:
            self.generate_analysis_plots(results, trajectory_data, output_dir)
            
        return results

    def generate_analysis_plots(self, results: Dict, trajectory_data: List[Dict], output_dir: str):
        """Generate comprehensive analysis plots"""
        os.makedirs(output_dir, exist_ok=True)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # Create figure with subplots
        plt.figure(figsize=(20, 15))
        
        # Plot 1: Quality scores distribution
        plt.subplot(2, 2, 1)
        scores = [r['quality_score'] for r in results['trial_results']]
        plt.hist(scores, bins=20, color='skyblue', edgecolor='black')
        plt.axvline(0.95, color='r', linestyle='--', label='High Quality Threshold')
        plt.title('Trial Quality Score Distribution')
        plt.xlabel('Quality Score')
        plt.ylabel('Count')
        plt.legend()
        
        # Plot 2: Movement trajectories
        plt.subplot(2, 2, 2)
        colors = plt.cm.rainbow(np.linspace(0, 1, len(trajectory_data)))
        for trial, color in zip(trajectory_data, colors):
            quality_score = results['trial_results'][trial['trial_num']-1]['quality_score']
            if quality_score > 0:  # Only plot valid trials
                plt.plot(trial['x_pos'], trial['y_pos'], color=color, 
                        alpha=quality_score, label=f'Trial {trial["trial_num"]}')
        plt.title('Movement Trajectories (Color = Quality)')
        plt.xlabel('X Position (px)')
        plt.ylabel('Y Position (px)')
        
        # Plot 3: Reaction Time vs Movement Time
        plt.subplot(2, 2, 3)
        rts = [r['metrics']['reaction_time'] for r in results['trial_results']]
        mts = [r['metrics']['movement_time'] for r in results['trial_results']]
        scores = [r['quality_score'] for r in results['trial_results']]
        plt.scatter(rts, mts, c=scores, cmap='viridis')
        plt.colorbar(label='Quality Score')
        plt.title('Reaction Time vs Movement Time')
        plt.xlabel('Reaction Time (ms)')
        plt.ylabel('Movement Time (ms)')
        
        # Plot 4: Trial Quality Over Time
        plt.subplot(2, 2, 4)
        trial_nums = [r['trial_number'] for r in results['trial_results']]
        scores = [r['quality_score'] for r in results['trial_results']]
        plt.plot(trial_nums, scores, 'b-', label='Quality Score')
        plt.axhline(0.95, color='r', linestyle='--', label='High Quality Threshold')
        plt.title('Trial Quality Over Time')
        plt.xlabel('Trial Number')
        plt.ylabel('Quality Score')
        plt.legend()
        
        plt.tight_layout()
        plt.savefig(os.path.join(output_dir, f'movement_analysis_{timestamp}.png'))
        plt.close()

class NumpyEncoder(json.JSONEncoder):
    """Custom encoder for NumPy data types"""
    def default(self, obj):
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        return super(NumpyEncoder, self).default(obj)

def convert_numpy_types(obj):
    """Recursively convert numpy types in nested structures"""
    if isinstance(obj, dict):
        return {key: convert_numpy_types(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_numpy_types(item) for item in obj]
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, (np.integer, np.floating)):
        return obj.item()
    else:
        return obj

def generate_report(results: Dict) -> str:
    """Generate a detailed text report of the analysis"""
    report_lines = []
    
    # Header
    report_lines.extend([
        "Motor Control Analysis Report",
        "===========================",
        "",
        "Session Summary",
        "--------------"
    ])
    
    # Session summary
    info = results['participant_info']
    report_lines.extend([
        f"Total Trials: {info['total_trials']}",
        f"Valid Trials: {info['valid_trials']}",
        f"High Quality Trials: {info['high_quality_trials']}",
        f"Mean Quality Score: {info['mean_quality_score']:.3f}",
        "",
        "Trial Details",
        "------------"
    ])
    
    # Trial details
    for trial in results['trial_results']:
        report_lines.extend([
            f"\nTrial {trial['trial_number']}:",
            f"Valid: {'Yes' if trial['is_valid'] else 'No'}",
            f"Quality Score: {trial['quality_score']:.3f}"
        ])
        
        if trial['issues']:
            report_lines.append("Issues:")
            report_lines.extend([f"- {issue}" for issue in trial['issues']])
        
        metrics = trial['metrics']
        report_lines.extend([
            "Metrics:",
            f"- Reaction Time: {metrics['reaction_time']:.1f} ms",
            f"- Movement Time: {metrics['movement_time']:.1f} ms",
            f"- Peak Velocity: {metrics['peak_velocity']:.1f} px/s",
            f"- Path Length: {metrics['path_length']:.1f} px",
            f"- Directness Ratio: {metrics['directness_ratio']:.3f}",
            f"- Movement Units: {metrics['movement_units']}",
            f"- Corrective Movements: {metrics['corrective_movements']}"
        ])
        
    return "\n".join(report_lines)

def main():
    """Main execution function"""
    import argparse
    
    # Set up command line argument parsing
    parser = argparse.ArgumentParser(description='Motor Control Data Validator')
    parser.add_argument('input_file', help='Path to input data file')
    parser.add_argument('--config', help='Path to configuration JSON file')
    parser.add_argument('--output-dir', help='Directory for output files', default='output')
    args = parser.parse_args()
    
    # Create output directory if it doesn't exist
    os.makedirs(args.output_dir, exist_ok=True)
    
    # Initialize validator
    validator = MotorControlValidator(args.config)
    
    try:
        # Analyze session
        print(f"Analyzing data from {args.input_file}...")
        results = validator.analyze_session(args.input_file, args.output_dir)
        
        # Generate and save report
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        report_text = generate_report(results)
        report_file = os.path.join(args.output_dir, f'analysis_report_{timestamp}.txt')
        
        with open(report_file, 'w') as f:
            f.write(report_text)
            
        # Print summary to console
        print("\nAnalysis Summary:")
        print("-----------------")
        print(f"Total Trials: {results['participant_info']['total_trials']}")
        print(f"Valid Trials: {results['participant_info']['valid_trials']}")
        print(f"High Quality Trials: {results['participant_info']['high_quality_trials']}")
        print(f"Mean Quality Score: {results['participant_info']['mean_quality_score']:.3f}")
        print(f"\nDetailed report saved to: {report_file}")
        
        # Export results as JSON
        # Convert numpy types before saving
        converted_results = convert_numpy_types(results)
        results_file = os.path.join(args.output_dir, f'analysis_results_{timestamp}.json')
        with open(results_file, 'w') as f:
            json.dump(converted_results, f, indent=2, cls=NumpyEncoder)
        print(f"Results data saved to: {results_file}")
        
    except Exception as e:
        print(f"Error during analysis: {str(e)}")
        raise

if __name__ == "__main__":
    main()