import cv2
from ultralytics import YOLO
import cvzone
import pyttsx3
import threading
from ipcam import cam
import requests

import time
import requests

import base64

# Firebase Realtime Database URL and API key
DATABASE_URL = "https://fishtank-2b906-default-rtdb.asia-southeast1.firebasedatabase.app"
API_KEY = "API_KEY"

# Function to update data in Firebase Realtime Database
def update_firebase(data):
    try:
        # URL to update data at a specific path (e.g., /object_counts)
        url = f"{DATABASE_URL}/object_counts.json?auth={API_KEY}"
        
        # Patch the data to the specified path
        response = requests.patch(url, json=data)
        if response.status_code == 200:
            print("Data updated in Firebase successfully.")
        else:
            print(f"Failed to update data in Firebase: {response.status_code}, {response.text}")
    except Exception as e:
        print(f"Error updating data in Firebase: {e}")

# Track the last time data was sent
last_sent_time = time.time()


# Initialize pyttsx3 for offline text-to-speech
engine = pyttsx3.init()

# Create a lock for thread safety
tts_lock = threading.Lock()

def play_sound(text):
    """ Function to convert text to speech using pyttsx3. """
    with tts_lock:  # Ensure that only one thread can access the TTS engine at a time
        engine.say(text)
        engine.runAndWait()

def play_sound_async(text):
    """ Run play_sound in a separate thread to avoid blocking. """
    thread = threading.Thread(target=play_sound, args=(text,))
    thread.start()
    
def is_moving(prev_box, current_box, tolerance=5):
    prev_x1, prev_y1, prev_x2, prev_y2 = prev_box
    x1, y1, x2, y2 = current_box
    return abs(x1 - prev_x1) > tolerance or abs(y1 - prev_y1) > tolerance or \
           abs(x2 - prev_x2) > tolerance or abs(y2 - prev_y2) > tolerance
           
def encode_img():
    # Encode image to Base64
    _, buffer = cv2.imencode('.jpg', cam())
    img_base64 = base64.b64encode(buffer).decode('utf-8')  # Convert bytes to a string
    
    return img_base64

# Load COCO class names
with open("coco.txt", "r") as f:
    class_names = f.read().splitlines()

# Load the YOLOv8 model
model = YOLO("yolo11s.pt")

# Open the video capture (use webcam)
cap = cv2.VideoCapture('http://192.168.55.61/video_feed')

# Dictionary to track how long each track_id has been stationary
stationary_durations = {}  # {track_id: stationary_seconds}
stationary_threshold = 0.1  # 1 hour in seconds

# Retrieve FPS and validate it
fps = cap.get(cv2.CAP_PROP_FPS)
if fps is None or fps <= 0:
    print("Setting default FPS to 30. Starting...")
    fps = 30  # Default FPS value
# Set to store already spoken track IDs to avoid repeating
spoken_ids = set()

# Dictionary to store previous positions of objects by track_id
prev_positions = {}

# Variables to track total, moving, and stationary objects
total_boxes = 0
moving_boxes = 0
stationary_boxes = 0
dead_num = 0

while True:
    frame = cam()
    frame = cv2.resize(frame, (1600, 1200))
    
    # Run YOLOv8 tracking on the frame, persisting tracks between frames
    results = model.track(frame, persist=True)

    # Reset counts for the current frame
    total_boxes = 0
    moving_boxes = 0
    stationary_boxes = 0
    dead_num = 0

    if results[0].boxes is not None and results[0].boxes.id is not None:
        # Get the boxes (x, y, w, h), class IDs, track IDs, and confidences
        boxes = results[0].boxes.xyxy.int().cpu().tolist()  # Bounding boxes
        class_ids = results[0].boxes.cls.int().cpu().tolist()  # Class IDs
        track_ids = results[0].boxes.id.int().cpu().tolist()  # Track IDs
        confidences = results[0].boxes.conf.cpu().tolist()  # Confidence score
        
        # Dictionary to count classes based on track IDs for the current frame
        current_frame_counter = {}
        
        for box, class_id, track_id in zip(boxes, class_ids, track_ids):
            total_boxes += 1
            x1, y1, x2, y2 = box
            
            # Check movement
            if track_id in prev_positions:
                if is_moving(prev_positions[track_id], (x1, y1, x2, y2)):
                    moving_boxes += 1
                    # Reset stationary duration if the object starts moving
                    if track_id in stationary_durations:
                        stationary_durations.pop(track_id)
                else:
                    stationary_boxes += 1
                    # Increment stationary duration
                    if track_id in stationary_durations:
                        stationary_durations[track_id] += 1 / fps
                    else:
                        stationary_durations[track_id] = 1 / fps
                        
                    # Check if stationary duration exceeds the threshold
                    if stationary_durations[track_id] >= stationary_threshold:
                        dead_num += 1
            else:
                stationary_boxes += 1
            
            # Update the stored position
            prev_positions[track_id] = (x1, y1, x2, y2)
            
            # Draw bounding boxes and labels
            c = class_names[class_id]
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cvzone.putTextRect(frame, f'{track_id}', (x1, y2), 1, 1)
            cvzone.putTextRect(frame, f'{c}', (x1, y1), 1, 1)
            
            # Count the object only if it's a new detection
            if track_id not in spoken_ids:
                spoken_ids.add(track_id)
                
            # Increment the count for the detected class
                if c not in current_frame_counter:
                    current_frame_counter[c] = 0
                current_frame_counter[c] += 1
                
        # Announce the current counts for each detected class
        for class_name, count in current_frame_counter.items():
            if count > 0:  # Only announce if there are detected objects
                count_text = f"{count} {class_name}" if count > 1 else f"One {class_name}"
                play_sound_async(count_text)  # Convert count to speech
                current_frame_counter[class_name] = 0  # Reset count after announcement
                
    # Prepare data for Firebase
    img_base64 = encode_img()
    data = {
        "total_boxes": total_boxes,
        "moving_boxes": moving_boxes,
        "stationary_boxes": stationary_boxes,
        "dead_num": dead_num,
        "timestamp": time.time(),  # Optionally include a timestamp
        "image": img_base64  # Include the Base64-encoded image
    }
    # Check if 1 minute (60 seconds) has passed since the last send
    if time.time() - last_sent_time >= 1:
        update_firebase(data)
        last_sent_time = time.time()  # Update the last sent time
    # try:
    #     response = requests.post(SERVER_URL, json=data)
    #     print("Response from server:", response.json())
    # except Exception as e:
    #     print(f"Error sending data to server: {e}")
        
    # Display counts
    cvzone.putTextRect(frame, f'Total Boxes: {total_boxes}', (20, 30), 1, 2)
    cvzone.putTextRect(frame, f'Moving Boxes: {moving_boxes}', (20, 60), 1, 2)
    cvzone.putTextRect(frame, f'Stationary Boxes: {stationary_boxes}', (20, 90), 1, 2)
    cvzone.putTextRect(frame, f'Dead Boxes: {dead_num}', (20, 120), 1, 2)
    cv2.imshow("RGB", frame)
    
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

# Release the video capture object and close the display window
cap.release()
cv2.destroyAllWindows()
