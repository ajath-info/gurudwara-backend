document.addEventListener('DOMContentLoaded', () => {
  try {
    // Get active tab from meta tag
    const activeTabMeta = document.querySelector('meta[name="active-tab"]');
    if (!activeTabMeta) {
      console.error('Meta tag for active-tab not found');
      return;
    }
    const activeTab = activeTabMeta.getAttribute('content') || 'profile';
    console.log('DOM loaded, activeTab:', activeTab);

    // Verify tab buttons
    const profileTab = document.getElementById('profile-tab');
    const securityTab = document.getElementById('security-tab');
    if (!profileTab || !securityTab) {
      console.error('Tab buttons not found:', {
        profileTab: !!profileTab,
        securityTab: !!securityTab,
      });
      return;
    }

    // Attach event listeners
    profileTab.addEventListener('click', () => {
      console.log('Profile tab clicked');
      showTab('profile');
    });
    securityTab.addEventListener('click', () => {
      console.log('Security tab clicked');
      showTab('security');
    });

    // Initialize active tab
    showTab(activeTab);
  } catch (error) {
    console.error('Error initializing tabs:', error);
  }
});

function showTab(tabId) {
  try {
    console.log('Switching to tab:', tabId);

    // Verify tab content exists
    const selectedTab = document.getElementById(tabId);
    if (!selectedTab) {
      console.error('Tab content not found for ID:', tabId);
      return;
    }

    // Hide all tab contents
    const tabContents = document.querySelectorAll('.tab-content');
    if (tabContents.length === 0) {
      console.error('No tab contents found');
      return;
    }
    tabContents.forEach(tab => {
      tab.classList.add('hidden');
    });

    // Show selected tab
    selectedTab.classList.remove('hidden');

    // Update tab button styles
    const tabButtons = document.querySelectorAll('.tab-button');
    if (tabButtons.length === 0) {
      console.error('No tab buttons found');
      return;
    }
    tabButtons.forEach(btn => {
      btn.classList.remove('border-blue-500', 'text-blue-600');
      btn.classList.add('border-transparent', 'text-gray-500', 'hover:text-gray-700');
    });

    const activeButton = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
    if (activeButton) {
      activeButton.classList.add('border-blue-500', 'text-blue-600');
      activeButton.classList.remove('border-transparent', 'text-gray-500', 'hover:text-gray-700');
    } else {
      console.error('Tab button not found for data-tab:', tabId);
    }
  } catch (error) {
    console.error('Error in showTab:', error);
  }
}
