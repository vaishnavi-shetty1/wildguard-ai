import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ShieldAlert, AlertTriangle } from "lucide-react";
import Header from "../components/Header";
import Overview from "../components/Overview";
import LiveMonitor from "../components/LiveMonitor";
import SmsCenter from "../components/SmsCenter";
import StakeholderPortal from "../components/StakeholderPortal";
import ClassifierTraining from "../components/ClassifierTraining";
import AdminPanel from "../components/AdminPanel";
import ThreatRadar from "../components/ThreatRadar";
import DetectionLogs from "../components/DetectionLogs";
import NotificationToast from "../components/NotificationToast";
import NotificationDrawer from "../components/NotificationDrawer";
import { handleWildlifePrediction } from "../utils/handleWildlifePrediction";
import { playNotificationSound, playThreatAlert, playSmsSound, playCameraConnectedSound, playCameraDisconnectedSound } from "../utils/audio";

const ROLE_TABS = {
  admin: [
    "home",
    "dashboard",
    "sms",
    "training",
    "admin",
  ],
  operator: [
    "home",
    "dashboard",
    "sms",
    "training",
  ],
  landowner: [
    "home",
    "stakeholder",
    "sms",
    "dashboard",
  ],
  village_head: [
    "home",
    "stakeholder",
    "sms",
    "dashboard",
  ],
};

const HomePage = () => {

  const navigate = useNavigate();
  const isDetectionLogsPage = window.location.pathname === "/detections";
  const [searchParams, setSearchParams] = useSearchParams();

  //user
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState("home");

  //notification
  const [notifications, setNotifications] = useState([]);
  const [detectionLogs, setDetectionLogs] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [toastNotification, setToastNotification] = useState(null);

  //camera
  const [cameraState, setCameraState] = useState({
      isActive: false,
      stream: null,
      cameraName: "",
      error: ""
    });

  //login user

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem( "wildguard_user" );
      if (!storedUser) {
        navigate("/login", { replace: true});
        return;
      }
      const user = JSON.parse(storedUser);
      setCurrentUser(user);
    } catch (error) {
      console.error( "Unable to load WildGuard user:", error);
      localStorage.removeItem( "wildguard_user" );
      localStorage.removeItem( "wildguard_token" );
      localStorage.removeItem( "wildguard_remember" );
      navigate("/login", { replace: true,});
    }
  }, [navigate]);

  //active tab from url
  useEffect(() => {
    const urlTab = searchParams.get("tab");
    if (urlTab) {
      setActiveTab(urlTab);
    } else {
      setActiveTab("home");
    }
  }, [searchParams]);

  //role access
  const canAccessTab = (tab) => {
    if (!currentUser) {
      return false;
    }
    const allowedTabs = ROLE_TABS[currentUser.role] || [];
    return allowedTabs.includes(tab);
  };

  //tab change
  const handleTabChange = (tab) => {
    if (!currentUser) {
      navigate("/login");
      return;
    }
    if (!canAccessTab(tab)) {
      console.warn(`Role ${currentUser.role} cannot access ${tab}`);
      return;
    }
    setActiveTab(tab);
    if (tab === "home") {
      setSearchParams({});
    } else {
      setSearchParams({tab});
    }
  };

  //notification audio
  const playNotificationAudio = (notification) => {
    try {
      switch (notification.type) {
        case "threat":
          playThreatAlert();
          break;
        case "sms":
          playSmsSound();
          break;
        case "camera_connected":
          playCameraConnectedSound();
          break;
        case "camera_disconnected":
          playCameraDisconnectedSound();
          break;
        case "ai":
          playNotificationSound();
          break;
        default:
          playNotificationSound();
          break;
      }
    } catch (error) {
      console.warn( "Unable to play notification sound:", error );
    }
  };

  //add notification
  const addNotification = (notification,playSound = true) => {
    const newNotification = {
      id: notification.id || `${Date.now()}-${Math.random()}`,
      timestamp: notification.timestamp || new Date().toISOString(),
      read: false,
      type: notification.type || "system",
      ...notification
    };
    //add notification history
    setNotifications((current) => [ newNotification, ...current ].slice(0, 30));
    //show toast notification
    setToastNotification(newNotification);
    //play sound
    if (playSound) {
      playNotificationAudio( newNotification);
    }
  };

  const onWildlifePrediction = (prediction) => {
    handleWildlifePrediction({ prediction, cameraState, setDetectionLogs, addNotification });
  };

  //mark notification as read
  const markNotificationRead = ( id ) => {
    setNotifications((current) =>current.map((notification) =>notification.id === id ? { ...notification, read: true } : notification));
  };

  //clear notifications
  const clearNotifications = () => {
    setNotifications([]);
  };

  //logout
  const handleLogout = () => {
    //stop logout camera
    if (cameraState.stream) {
      cameraState.stream.getTracks().forEach((track) => {
          track.stop();
        });
    }
    setCameraState({ isActive: false, stream: null, cameraName: "", error: ""});
    //clear authentication
    localStorage.removeItem("wildguard_user" );
    localStorage.removeItem( "wildguard_token" );
    localStorage.removeItem("wildguard_remember");
    setCurrentUser(null);
    navigate("/login", { replace: true});
  };

  //unread count
  const unreadCount =notifications.filter((notification) =>!notification.read).length;

  //open notification drawer
  const openNotifications = () => {
    setShowNotifications(true);
    //mark all read
    setNotifications((current) => current.map((notification) => ({ ...notification, read: true})));
  };

  //close notification drawer
  const closeNotifications = () => {
    setShowNotifications(false);
  };

  //initialize system notifications
  useEffect(() => {
    setNotifications([
      {
        id: "system-1",
        title: "Wildlife Monitoring Active",
        message: "All connected surveillance nodes are operational.",
        type: "system",
        read: false,
        timestamp: new Date().toISOString()
      },
      {
        id: "sms-1",
        title: "SMS Gateway Ready",
        message: "WildGuard SMS notification service is ready.",
        type: "sms",
        read: false,
        timestamp: new Date().toISOString()
      },
      {
        id: "ai-1",
        title: "AI Classifier Online",
        message: "Wildlife classification model is ready for monitoring.",
        type: "ai",
        read: true,
        timestamp: new Date().toISOString()
      },
    ]);
  }, []);

  //camera cleanup
  useEffect(() => {
    return () => {
      if (cameraState.stream) {
        cameraState.stream.getTracks().forEach((track) => {
            track.stop();
          });
      }
    };
  }, [cameraState.stream]);

  //auto close toast after 6 secs

  useEffect(() => {
    if (!toastNotification) {
      return;
    }
    const timer = setTimeout(() => { setToastNotification(null);}, 6000);
    return () => {
      clearTimeout(timer);
    };
  }, [toastNotification]);

  //loading screen
  if (!currentUser) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#061418]">
        <div className="flex flex-col items-center gap-4">
          <div className="grid size-14 animate-pulse place-items-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
            <ShieldAlert size={28}/>
          </div>
          <p className="text-sm text-slate-400">
            Loading WildGuard...
          </p>
        </div>
      </div>
    );
  }

  const renderActiveComponent = () => {
    if (isDetectionLogsPage) {
      return (
        <DetectionLogs detectionLogs={detectionLogs}/>
      );
    }
    //overview
    if (activeTab === "home") {
      return (
        <Overview currentUser={currentUser} notifications={notifications} detectionLogs={detectionLogs} />
      );
    }

    //dashboard
    if ( activeTab === "dashboard" ) {
      //admin, operator -- live monitor
      if ( currentUser.role === "admin" || currentUser.role === "operator" ) {
        return (
          <LiveMonitor currentUser={currentUser} cameraState={cameraState} setCameraState={setCameraState} onNotification={addNotification} onPrediction={onWildlifePrediction}/>
        );
      }
      //landowner , village head -- threat radar
      if ( currentUser.role === "landowner" || currentUser.role === "village_head" ) {
        return (
          <ThreatRadar currentUser={currentUser} cameraState={cameraState} setCameraState={setCameraState} onNotification={addNotification} onPrediction={onWildlifePrediction}/>
        );
      }
      return (
        <AccessDenied role={currentUser.role}/>
      );
    }

    //sms center
    if (activeTab === "sms") {
      return (
        <SmsCenter currentUser={currentUser} onNotification={addNotification}/>
      );
    }

    //stakeholders portal
    if (activeTab === "stakeholder" ) {
      if ( currentUser.role !== "landowner" && currentUser.role !== "village_head" ) {
        return (
          <AccessDenied role={currentUser.role} />
        );
      }
      return (
        <StakeholderPortal currentUser={currentUser} onNotification={addNotification}/>
      );
    }

    //classifier training
    if ( activeTab === "training" ) {
      if ( currentUser.role !== "admin" && currentUser.role !== "operator" ) {
        return (
          <AccessDenied role={currentUser.role}/>
        );
      }
      return (
        <ClassifierTraining currentUser={currentUser} onNotification={addNotification}/>
      );
    }

    //admin panel
    if ( activeTab === "admin" ) {
      if ( currentUser.role !== "admin" ) {
        return (
          <AccessDenied role={currentUser.role}/>
        );
      }
      return (
        <AdminPanel currentUser={currentUser} onNotification={addNotification}/>
      );
    }
    return (
      <AccessDenied role={currentUser.role}/>
    );
  };

  //main page

  return (
    <div className="min-h-screen bg-[#061418] text-slate-100">

      {/* header */}
      <Header currentUser={currentUser} activeTab={activeTab} setActiveTab={handleTabChange} onLogout={handleLogout} unreadCount={unreadCount} onOpenNotifications={openNotifications}/>

      {/* ai notification toast */}
      <NotificationToast notification={toastNotification} onClose={() => setToastNotification(null)}/>

      {/* main content */}
      <main className="mx-auto w-full max-w-350 px-3 py-4 sm:px-4 md:px-6 md:py-6">
        {renderActiveComponent()}
      </main>

      {/* notification drawer */}
      {showNotifications && (
        <NotificationDrawer notifications={notifications} onClose={ closeNotifications} onMarkRead={markNotificationRead} onClearAll={clearNotifications}/>
      )}

    </div>
  );
};

const AccessDenied = ({role}) => {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950/80 p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-red-500/10 text-red-400">
          <AlertTriangle size={28}/>
        </div>

        <h2 className="mb-2 text-xl font-bold text-slate-100">Access Restricted</h2>

        <p className="mb-4 text-sm leading-6 text-slate-400">
          Your current role does not have permission to access this WildGuard module.
        </p>

        <div className="inline-flex items-center rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-slate-400">
          Role: {role}
        </div>
      </div>
    </div>
  );
};

export default HomePage;