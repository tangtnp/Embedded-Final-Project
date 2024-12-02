"use client";
import React, { useEffect, useState } from 'react';
import { database, ref, onValue, update } from '@/firebase/firebase';
import './App.css';

// Update interface to match database fields
interface Data {
  //livestreamLink: string;
  image : string;
  phData: number;
  tempData: number;
  weightData: number;
  waterLevelData: boolean;
  servoStatus: boolean;
  moving_boxes: number; // New field
  dead_num: number;     // New field
}

const App: React.FC = () => {

  // const [data, setData] = useState<Data | null>(null);

  // useEffect(() => {
  //   const dbRef = ref(database, 'liveData');
  //   const unsubscribe = onValue(dbRef, (snapshot) => {
  //     if (snapshot.exists()) {
  //       setData(snapshot.val());
  //     } else {
  //       console.error('No data available');
  //     }
  //   });

  //   return () => unsubscribe();
  // }, []);


  // const handleToggle = (newState: boolean) => {
  //   const dbRef = ref(database, 'liveData');
  //   update(dbRef, { value5: newState }).catch((error) =>
  //     console.error('Error updating value5:', error)
  //   );
  // };


  // const mockData = {
  //   livestreamLink: 'https://example.com/livestream', // Replace with a real video link for testing
  //   value1: 1.23,
  //   value2: 4.56,
  //   value3: false,
  //   value4: 0.12,
  //   value5: false,
  // };
  
  // const [data, setData] = useState(mockData);

  const [data, setData] = useState<Data | null>(null);

  //const [isOpen, setIsOpen] = useState(false); // Tracks if the button is in the "Open" state
  const [isHovered, setIsHovered] = useState(false); // Tracks if the button is hovered
  const [isDisabled, setIsDisabled] = useState(false); // Tracks if the button is disabled

  //fect from firebase
  useEffect(() => {
    // Real-time listener for Firebase data
    console.log("Hi");  // Log data to verify
    const dbRef = ref(database, "Sensor");
    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        console.log("Received data:", snapshot.val());  // Log data to verify
        //setData(snapshot.val());
        setData((prevData) => ({
          ...prevData,
          ...snapshot.val(),
        }));
      } else {
        console.error("No data available");
      }
    });

    //fetching from object_counts
    console.log("Hi");  // Log data to verify
    const dbRef2 = ref(database, "object_counts");
    const unsubscribe2 = onValue(dbRef2, (snapshot) => {
      if (snapshot.exists()) {
        console.log("Received data from object_counts:", snapshot.val());
        setData((prevData) => ({
          ...prevData,
          ...snapshot.val(),
        }));
      } else {
        console.error("No data available");
      }
    });

     // Start the auto-feeding mechanism
     const autoFeedingInterval = setInterval(() => {
      checkAutoFeeding();
    }, 60 * 1000); // Check every minute

    return () => {
      unsubscribe();
      unsubscribe2();
      clearInterval(autoFeedingInterval); // Cleanup interval on unmount
    };

  }, []);


  // const handleClick = () => {
  //   setIsOpen(true); // Set to "Open" when clicked
  //   setIsDisabled(true); // Disable the button
  //   setTimeout(() => {
  //     setIsOpen(false); // Revert to "Close" after 3 seconds
  //     setIsDisabled(false); // Enable the button
  //   }, 3000);
  // };


  //handle click for firebase
  const handleClick = () => {
    if (!data) return;

    const dbRef = ref(database, "Sensor");

    // Set button to "Open" by writing 1 to Firebase
    setIsDisabled(true);
    update(dbRef, { servoStatus: true })
      .then(() => {
        setTimeout(() => {
          // After 3 seconds, revert back to "Close" by writing 0 to Firebase
          update(dbRef, { servoStatus: false })
            .catch((error) => console.error("Error reverting servoStatus:", error));
          setIsDisabled(false);
        }, 7000);
      })
      .catch((error) => console.error("Error updating servoStatus:", error));
  };

  const checkAutoFeeding = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Check for 8:00 AM or 6:00 PM
    if (
      (currentHour === 8 && currentMinute === 0) ||
      (currentHour === 18 && currentMinute === 0)
    ) {
      handleClick(); // Trigger feeding
    }
  };



  const handleMouseEnter = () => setIsHovered(true); // Set hover state
  const handleMouseLeave = () => setIsHovered(false); // Remove hover state

  return (
    <div className="App">
      {data ? (
        <>
          <div className="video-container">
            {/* <iframe
              src={data.livestreamLink+'1600x1200.mjpeg'}
              title="Livestream"
              frameBorder="0"
              allow="autoplay; fullscreen"
              allowFullScreen
              className="video-frame"
            /> */}
            {data?.image ? (
              <img
                src={`data:image/jpeg;base64,${data.image}`}
                alt="Live Feed"
                className="video-frame"
              />
            ) : (
              <p>Loading image...</p>
            )}
            {/* Add values overlay */}
            <div className="video-overlay">
              <div className="overlay-value">
                Moving Boxes: {data.moving_boxes}
              </div>
              <div className="overlay-value">
                Dead Num: {data.dead_num}
              </div>
            </div>
          </div>
          <div className="values-container">
            {/* First row of values */}
              <div className="value-row">
              <div className={data.phData < 6.5 || data.phData > 8.5 ? "valueNotify" : "value"}>
                pH : {data.phData}
              </div>
              <div className={data.tempData < 18 || data.tempData > 30 ? "valueNotify" : "value"}>
                Temp : {data.tempData}
              </div>
              <div className={data.waterLevelData ? "value" : "valueNotify"}>
                Properly water level  : {data.waterLevelData ? 'true' : 'false'}
              </div>
            </div>

            {/* Second row for Value 4 and the Toggle Button */}
            <div className="value-row">
              <div className={data.weightData < 60 ? "valueNotify" : "value"}>
                  Food left: {data.weightData} gram
              </div>
            <button
                className={`toggle-button ${
                  data.servoStatus ? "open" : ""
                } ${isHovered && !data.servoStatus ? "hover" : ""}`}
                onClick={handleClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                disabled={isDisabled} // Disable button while processing
              >
                {data.servoStatus ? "Open" : isHovered ? "Click to Open" : "Open"}
              </button>
            </div>
          </div>
        </>
      ) : (
        <p>Loading data...</p>
      )}
    </div>
  );
};

export default App;