import React, { useState, useEffect } from 'react';
import useStore from '../../store/useStore';
import BroadcastAlert from './BroadcastAlert';

const GoodMorningAlert = () => {
  const { user, _hasHydrated } = useStore();
  const [show, setShow] = useState(false);
  const [greetingType, setGreetingType] = useState('');

  useEffect(() => {
    if (user && _hasHydrated) {
      const now = new Date();
      const hour = now.getHours();
      
      let type = '';
      // Morning is between 5:00 AM and 11:59 AM
      if (hour >= 5 && hour < 12) {
        type = 'morning';
      } 
      // Afternoon/PM is from 12:00 PM onwards (until 11:59 PM)
      else if (hour >= 12) {
        type = 'afternoon';
      }
      
      if (type) {
        const todayStr = now.toDateString();
        // Separate keys so they can see one in the morning AND one in the afternoon
        const lastShownKey = `greeting_${type}_${user.id}`;
        const lastShown = localStorage.getItem(lastShownKey);
        
        // Show if not already shown today
        if (lastShown !== todayStr) {
          localStorage.setItem(lastShownKey, todayStr);
          setGreetingType(type);
          setShow(true);
        }
      }
    }
  }, [user, _hasHydrated]);

  if (!show) return null;

  const isMorning = greetingType === 'morning';
  const imageSrc = isMorning ? 'good_morning.png' : 'good_afternoon.png';
  const title = isMorning ? 'Good Morning' : 'Good Afternoon';

  // By starting with a slash, BroadcastAlert will automatically prepend the API_BASE_URL
  // fetching the image from the backend, which now serves the NAS assets directory!
  const mockBroadcast = {
    title: title,
    message: `![${title}](/api/assets/${imageSrc})`
  };

  return <BroadcastAlert broadcast={mockBroadcast} onClose={() => setShow(false)} />;
};

export default GoodMorningAlert;
