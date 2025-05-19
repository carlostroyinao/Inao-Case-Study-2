import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useNavigate, Link, useLocation } from "react-router-dom";
import 'react-toastify/dist/ReactToastify.css';
import "./AdminApp.css"
import logo from '../src/images/logo.png';
import { IoHomeOutline, IoPeopleOutline, IoBarChartOutline, IoAddCircleOutline, IoLogOutOutline, IoSearchOutline } from "react-icons/io5";
import { Html5Qrcode } from 'html5-qrcode';

const API_URL = 'http://localhost:5000/attendance';

function Attendance() {
  
  const [searchTerm, setSearchTerm] = useState('');
  const [totalResidents, setTotalResidents] = useState(0);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState([]);

  const navigate = useNavigate();
  const location = useLocation();

  // Fetch all attendee
  const fetchAttendance = async () => {
    try {
      const response = await axios.get(API_URL);
      setAttendanceRecords(response.data);
      setTotalResidents(response.data.length); // Optional: rename this state if needed
    } catch (error) {
      console.error('Error fetching attendance records:', error);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, []);

  // Logout function
  const handleLogout = () => {
    setTimeout(() => {
      navigate("/"); // Redirect to Login Page
    } );
  };

  // Handle search change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const filteredAttendance = attendanceRecords.filter(resident =>
    Object.entries(resident).some(([key, value]) => {
      if (!value) return false; // Ignore null or undefined values
      const lowerValue = value.toString().trim().toLowerCase();
      const lowerSearch = searchTerm.trim().toLowerCase();
  
      // Ensure exact match for categorical fields
      if (["sex", "gender"].includes(key)) {
        return lowerValue === lowerSearch; // Exact match only
      }
  
      // Partial match for other fields
      return lowerValue.includes(lowerSearch);
    })
  );

  const handleExportAttendance = () => {
      if (filteredAttendance.length === 0) {
        toast.warn('No data available to export!', { autoClose: 1500 });
        return;
      }
  
      const headers = [
        "ID", "Last Name", "First Name", "M.I."
      ];
  
      const csvRows = [
        headers.join(','), // Header row
        ...filteredAttendance.map(resident =>
          [
            resident.id,
            resident.last_name,
            resident.first_name,
            resident.middle_initial,
          ].map(val => `"${val}"`).join(',')
        )
      ];
  
      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'attendance_data.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  
      toast.success('CSV exported successfully!', { autoClose: 1500 });
    };
  
  const QRScanner = ({ onClose }) => {
    const scannerRef = useRef(null);
    const isStoppedRef = useRef(false);
    const hasStartedRef = useRef(false);

    useEffect(() => {
      // Prevent duplicate video feed
      const readerElem = document.getElementById("qr-reader");
      if (readerElem) readerElem.innerHTML = "";

      // Check for camera permission
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(() => {
          console.log("Camera permission granted");
        })
        .catch((err) => {
          console.error("Camera permission denied", err);
          alert("Please allow camera access.");
          return;
        });

      const html5QrCode = new Html5Qrcode("qr-reader");
      scannerRef.current = html5QrCode;

      const startScanner = async () => {
        try {
          await html5QrCode.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            async (decodedText) => {
              if (isStoppedRef.current || !hasStartedRef.current) return; // Prevent duplicate scans
              isStoppedRef.current = true;

              console.log("QR Code Scanned:", decodedText);

              try {
                let cleanedText = decodedText;

                try {
                  const test = JSON.parse(decodedText);
                  if (typeof test === 'string') {
                    cleanedText = test;
                  }
                } catch (e) {}

                const parsedData = JSON.parse(cleanedText);
                console.log("Parsed Data:", parsedData);

                const res = await fetch("http://localhost:5000/attendance/scan", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(parsedData),
                });

                const data = await res.json();
                toast.success(data.message || "Scan recorded", { autoClose: 1500 });

                await html5QrCode.stop();
                hasStartedRef.current = false;
                onClose();
                fetchAttendance(); // Refresh attendance list
              } catch (err) {
                console.error("Error handling scan:", err);
                toast.error("Error recording attendance");
                isStoppedRef.current = false; // Allow retry if something failed
              }
            },
            (errorMessage) => {
              console.error("Error in QR scanning:", errorMessage);
            }
          );
          hasStartedRef.current = true;
        } catch (error) {
          console.error("Error starting QR scanner:", error);
        }
      };

      startScanner();

      return () => {
        if (!isStoppedRef.current && hasStartedRef.current && scannerRef.current) {
          isStoppedRef.current = true;
          scannerRef.current.stop().then(() => {
            console.log("Scanner stopped on unmount.");
          }).catch(console.error);
        }
      };
    }, [onClose]);

    return <div id="qr-reader" style={{ width: "50%", height: "55vh" }}></div>;
  };

  const handleDeleteAll = async () => {
    try {
      const confirmed = window.confirm("Are you sure you want to delete all attendance records?");
      if (!confirmed) return;

      const res = await axios.delete("http://localhost:5000/attendance");
      toast.success(res.data.message || "All records deleted");
      fetchAttendance(); // refresh table
    } catch (error) {
      console.error("Delete failed:", error);
      toast.error("Failed to delete attendance records");
    }
  };


  return (
    <div class="container">
        <div class="navigation">
            <ul>
                <li>
                    <Link>
                        <span class="icon">
                            <img src={logo} alt="Logo" className="logo-photo" />
                        </span>
                        <span class="title-logo">Sta. Filomena</span>
                    </Link>
                </li>
                <li>
                    <Link to="/home" className={location.pathname === "/home" ? "active" : ""}>
                        <span className="icon">
                        <IoHomeOutline size={24} />
                        </span>
                        <span className="title">Home</span>
                    </Link>
                </li>
                <li>
                    <Link to="/dashboard" className={location.pathname === "/dashboard" ? "active" : ""}>
                        <span className="icon">
                        <IoBarChartOutline size={24} />
                        </span>
                        <span className="title">Dashboard</span>
                    </Link>
                </li>

                <li>
                    <Link to="/residents" className={location.pathname === "/residents" ? "active" : ""}>
                        <span className="icon">
                        <IoPeopleOutline size={24} />
                        </span>
                        <span className="title">Residents</span>
                    </Link>
                </li>

                <li>
                    <Link to="/addresident" className={location.pathname === "/addresident" ? "active" : ""}>
                        <span className="icon">
                        <IoAddCircleOutline size={24} />
                        </span>
                        <span className="title">Add Resident</span>
                    </Link>
                </li>

                <li>
                    <Link to="/attendance" className={location.pathname === "/attendance" ? "active" : ""}>
                        <span className="icon">
                        <IoPeopleOutline size={24} />
                        </span>
                        <span className="title">Attendance</span>
                    </Link>
                </li>

                <li>
                  <Link to="/logout" className="logout-link" onClick={handleLogout}>
                      <span className="icon">
                      <IoLogOutOutline size={24} />
                      </span>
                      <span className="title">Sign out</span>
                  </Link>
                </li>
            </ul>
        </div>

        <div class="main">
          <div className="data-visualization-container">
            <span className="with-icon">
              <IoPeopleOutline size={30} />
              <h1>Attendance</h1>
            </span>
          </div>
          <div className="data-visualization-container">
            <span className="with-icon">
              <div>
                <div>{totalResidents} Total Attendance</div>
              </div>
            </span>
          </div>
          
            <div class="details">
                <div class="recentOrders">
                    <div class="cardHeader">
                        <h2>Attendance Information</h2>
                        <div>
                          <button className="btn" onClick={handleExportAttendance}>Export Data</button>
                          <button className="btn" onClick={() => setScannerOpen(true)}>Scan QR</button>
                          <button className="btn" onClick={handleDeleteAll}>Delete All Data</button>
                        </div>
                    </div>
                    <div className="search-container">
                      <IoSearchOutline className="search-icon" size={20} />
                      <input type="text" placeholder="Search Resident..." value={searchTerm} onChange={handleSearchChange}/>
                    </div>
                  <div id="printableTable">
                    <table>
                        <thead>
                            <tr>
                                <td>ID</td>
                                <td>Last Name</td>
                                <td>First Name</td>
                                <td>M.I.</td>
                                <td>Time In</td>
                            </tr>
                        </thead>

                        <tbody>
                          {filteredAttendance
                            .sort((a, b) => new Date(b.scanTime) - new Date(a.scanTime)) // Newest first
                            .map((record, index) => (
                              <tr key={index}>
                                <td>{record.residentId}</td>
                                <td>{record.last_name}</td>
                                <td>{record.first_name}</td>
                                <td>{record.middle_initial}</td>
                                <td>{new Date(record.scanTime).toLocaleString()}</td>
                              </tr>
                            ))}
                        </tbody>
                    </table>
                  </div>
                </div>
            </div>
        </div>
        {scannerOpen && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-content">
                <QRScanner onClose={() => setScannerOpen(false)} />
                <button className="btn cancel" onClick={() => setScannerOpen(false)}>Close Scanner</button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

export default Attendance;