self.addEventListener('install', event => {
    console.log('Service Worker installing.');
});

self.addEventListener('activate', event => {
    console.log('Service Worker activating.');
});

self.addEventListener('push', event => {
    const data = event.data.json();
    console.log('Push received:', data);

    const title = data.title || 'Workout Reminder';
    const options = {
        body: data.message || 'Time to work out!',
        icon: 'icon.png', // You should have an icon file
    };

    event.waitUntil(self.registration.showNotification(title, options));
});
