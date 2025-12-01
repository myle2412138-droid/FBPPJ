import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TextInput, TouchableOpacity, FlatList, StatusBar, Platform, KeyboardAvoidingView, Modal, ActivityIndicator, ScrollView, Keyboard, Image, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome } from '@expo/vector-icons';

// --- Configuration ---
const API_BASE_URL = 'https://viegrand.site/phpfpb';
const GROQ_API_KEY = ''; // Set your API key here or use environment variable

// --- Constants & Theme ---
const THEME = {
  colors: {
    background: '#0f172a',
    primaryGradient: ['#667eea', '#764ba2'],
    secondary: '#1e293b',
    text: '#f8fafc',
    textSecondary: '#cbd5e1',
    border: 'rgba(255, 255, 255, 0.1)',
    inputBg: '#1e293b',
    userMessage: ['#667eea', '#764ba2'],
    botMessage: '#1e293b',
    accent: '#4ade80',
    danger: '#ef4444',
    success: '#22c55e',
  },
  spacing: { s: 8, m: 16, l: 24 },
  borderRadius: { s: 12, m: 20, l: 30 }
};

export default function App() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const flatListRef = useRef(null);

  // Initial Load
  useEffect(() => {
    fetchLatestReport();
    loadSuggestions();
  }, []);

  const loadSuggestions = () => {
    setSuggestions([
      { id: '1', text: 'Danh sách bệnh nhân', icon: 'list', action: 'list_patients' },
      { id: '2', text: 'Báo cáo mới nhất', icon: 'clock-o', action: 'latest_report' },
      { id: '3', text: 'Nguyên lý FBP là gì?', icon: 'question-circle', action: 'chat' },
    ]);
  };

  // --- API Functions ---

  const fetchLatestReport = async () => {
    addBotMessage('Đang tải báo cáo mới nhất...', true);
    try {
      const response = await fetch(`${API_BASE_URL}/get_latest.php`);
      const json = await response.json();
      removeLoadingMessage();

      if (json.success && json.data) {
        const report = json.data;
        const text = `🔔 **BÁO CÁO MỚI NHẤT**\n\n👤 Bệnh nhân: ${report.patient_name}\n📅 Thời gian: ${report.timestamp}\n📊 Số khối u: ${report.tumor_count}\n📝 Trạng thái: ${report.patient_status}`;

        addBotMessage(text, false, report);
      } else {
        addBotMessage('Chào bạn! Hiện chưa có báo cáo nào trên hệ thống.');
      }
    } catch (error) {
      removeLoadingMessage();
      addBotMessage('⚠️ Không thể kết nối đến server.');
    }
  };

  const fetchPatients = async () => {
    addBotMessage('Đang tải danh sách bệnh nhân...', true);
    try {
      const response = await fetch(`${API_BASE_URL}/get_patients.php`);
      const json = await response.json();
      removeLoadingMessage();

      if (json.success && json.patients.length > 0) {
        let msg = "📋 **DANH SÁCH BỆNH NHÂN**\n";
        json.patients.forEach(p => {
          msg += `\n- **${p.name}**: ${p.report_count} báo cáo (Mới nhất: ${p.latest_report.timestamp})`;
        });
        msg += "\n\n_Nhập tên bệnh nhân để xem chi tiết._";
        addBotMessage(msg);
      } else {
        addBotMessage('Chưa có dữ liệu bệnh nhân nào.');
      }
    } catch (error) {
      removeLoadingMessage();
      addBotMessage('❌ Lỗi khi tải danh sách bệnh nhân.');
    }
  };

  const searchReport = async (query) => {
    addBotMessage(`Đang tìm kiếm "${query}"...`, true);
    try {
      const response = await fetch(`${API_BASE_URL}/search_reports.php?query=${encodeURIComponent(query)}`);
      const json = await response.json();
      removeLoadingMessage();

      if (json.success && json.matches.length > 0) {
        const match = json.matches[0];
        const report = match.report;
        const text = `📄 **KẾT QUẢ TÌM KIẾM**\n\n👤 Bệnh nhân: ${report.patient_name}\n📅 Thời gian: ${report.timestamp}\n📊 Số khối u: ${report.tumor_count}\n📝 Trạng thái: ${report.patient_status}`;
        addBotMessage(text, false, report);
      } else {
        addBotMessage(`Không tìm thấy báo cáo nào cho "${query}".`);
      }
    } catch (error) {
      removeLoadingMessage();
      addBotMessage('❌ Lỗi khi tìm kiếm.');
    }
  };

  const callGroqAPI = async (userMessage) => {
    if (!GROQ_API_KEY) {
      setTimeout(() => {
        addBotMessage("⚠️ Chưa có API Key. Vui lòng cập nhật `GROQ_API_KEY` trong App.js để chat với AI.");
      }, 500);
      return;
    }

    addBotMessage("Đang suy nghĩ...", true);

    try {
      const history = [
        { role: "system", content: "Bạn là Trợ lý AI Y tế thông minh, chuyên về chẩn đoán hình ảnh và thuật toán Filter Back-Projection (FBP). Trả lời ngắn gọn, chuyên nghiệp." },
        ...messages.map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text })).slice(-5),
        { role: "user", content: userMessage }
      ];

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: history,
          max_tokens: 500
        })
      });

      const data = await response.json();
      removeLoadingMessage();

      if (data.choices && data.choices.length > 0) {
        addBotMessage(data.choices[0].message.content);
      } else {
        addBotMessage("❌ Lỗi từ AI: Không nhận được phản hồi.");
      }
    } catch (error) {
      removeLoadingMessage();
      addBotMessage(`❌ Lỗi kết nối AI: ${error.message}`);
    }
  };

  // --- Helper Functions ---

  const addBotMessage = (text, loading = false, reportData = null) => {
    const msg = {
      id: Date.now().toString(),
      text,
      sender: 'bot',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      loading,
      reportData
    };
    setMessages(prev => [...prev, msg]);
  };

  const removeLoadingMessage = () => {
    setMessages(prev => prev.filter(m => !m.loading));
  };

  const handleSend = () => {
    if (inputText.trim().length === 0) return;

    const text = inputText;
    setInputText('');

    const userMsg = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, userMsg]);

    const lowerText = text.toLowerCase();
    if (lowerText.includes('danh sách') || lowerText.includes('bệnh nhân')) {
      fetchPatients();
    } else if (lowerText.includes('mới nhất') || lowerText.includes('latest')) {
      fetchLatestReport();
    } else if (lowerText.startsWith('/report') || lowerText.length < 20 && (lowerText.includes(' ') === false)) {
      const query = lowerText.replace('/report', '').trim();
      searchReport(query || text);
    } else {
      callGroqAPI(text);
    }
  };

  const handleSuggestion = (item) => {
    if (item.action === 'list_patients') fetchPatients();
    else if (item.action === 'latest_report') fetchLatestReport();
    else {
      setInputText(item.text);
    }
  };

  const openReportModal = (report) => {
    setSelectedReport(report);
    setModalVisible(true);
  };

  const fixUrl = (url) => url.startsWith('http') ? url : `${API_BASE_URL}/${url.replace(/^\//, '')}`;

  const openVideo = (url) => {
    if (url) {
      Linking.openURL(fixUrl(url));
    }
  };

  const renderItem = ({ item }) => {
    const isUser = item.sender === 'user';
    return (
      <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowBot]}>
        {!isUser && (
          <View style={styles.avatarContainer}>
            <LinearGradient colors={THEME.colors.primaryGradient} style={styles.avatar}>
              <FontAwesome name="android" size={16} color="white" />
            </LinearGradient>
          </View>
        )}

        {isUser ? (
          <LinearGradient
            colors={THEME.colors.primaryGradient}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[styles.messageBubble, styles.messageBubbleUser]}
          >
            <Text style={styles.messageTextUser}>{item.text}</Text>
            <Text style={styles.timeTextUser}>{item.time}</Text>
          </LinearGradient>
        ) : (
          <View style={[styles.messageBubble, styles.messageBubbleBot]}>
            {item.loading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator size="small" color={THEME.colors.accent} />
                <Text style={[styles.messageTextBot, { marginLeft: 8 }]}>{item.text}</Text>
              </View>
            ) : (
              <>
                <Text style={styles.messageTextBot}>{item.text}</Text>

                {item.reportData && (
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => openReportModal(item.reportData)}
                    >
                      <FontAwesome name="file-text-o" size={14} color="white" />
                      <Text style={styles.actionButtonText}>Xem chi tiết</Text>
                    </TouchableOpacity>

                    {item.reportData.video_url && (
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#3b82f6' }]}
                        onPress={() => openVideo(item.reportData.video_url)}
                      >
                        <FontAwesome name="play-circle" size={14} color="white" />
                        <Text style={styles.actionButtonText}>Xem Video</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                <Text style={styles.timeTextBot}>{item.time}</Text>
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton}>
            <FontAwesome name="angle-left" size={24} color={THEME.colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>FBP Assistant</Text>
            <View style={styles.statusIndicator}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Online</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.menuButton}>
            <FontAwesome name="ellipsis-v" size={20} color={THEME.colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Chat Area */}
      <LinearGradient colors={[THEME.colors.background, '#1e1e2e']} style={styles.chatContainer}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      </LinearGradient>

      {/* Suggestions */}
      <View style={styles.suggestionsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {suggestions.map((item) => (
            <TouchableOpacity key={item.id} style={styles.suggestionChip} onPress={() => handleSuggestion(item)}>
              <FontAwesome name={item.icon} size={14} color={THEME.colors.textSecondary} style={{ marginRight: 6 }} />
              <Text style={styles.suggestionText}>{item.text}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        style={styles.inputWrapper}
      >
        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachButton}>
            <FontAwesome name="plus" size={20} color={THEME.colors.textSecondary} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Nhập tin nhắn..."
            placeholderTextColor={THEME.colors.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity onPress={handleSend} style={styles.sendButtonContainer}>
            <LinearGradient colors={THEME.colors.primaryGradient} style={styles.sendButton}>
              <FontAwesome name="paper-plane" size={16} color="white" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Native Report Detail Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chi tiết Báo cáo</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <FontAwesome name="close" size={24} color={THEME.colors.text} />
              </TouchableOpacity>
            </View>

            {selectedReport ? (
              <ScrollView style={styles.reportScroll} contentContainerStyle={{ padding: 20 }}>
                {/* Patient Info Card */}
                <View style={styles.infoCard}>
                  <Text style={styles.infoTitle}>Thông tin bệnh nhân</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Họ tên:</Text>
                    <Text style={styles.infoValue}>{selectedReport.patient_name}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Thời gian:</Text>
                    <Text style={styles.infoValue}>{selectedReport.timestamp}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Số khối u:</Text>
                    <Text style={[styles.infoValue, { color: selectedReport.tumor_count > 0 ? THEME.colors.danger : THEME.colors.success, fontWeight: 'bold' }]}>
                      {selectedReport.tumor_count}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Trạng thái:</Text>
                    <Text style={[styles.infoValue, { color: selectedReport.tumor_count > 0 ? THEME.colors.danger : THEME.colors.success }]}>
                      {selectedReport.patient_status}
                    </Text>
                  </View>
                </View>

                {/* Summary */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Tóm tắt chẩn đoán</Text>
                  <Text style={styles.sectionText}>{selectedReport.report_text || 'Không có mô tả chi tiết.'}</Text>
                </View>

                {/* Images Grid */}
                {selectedReport.detected_frames && selectedReport.detected_frames.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Hình ảnh phát hiện</Text>
                    <View style={styles.imageGrid}>
                      {selectedReport.detected_frames.map((url, index) => (
                        <View key={index} style={styles.imageWrapper}>
                          <Image
                            source={{ uri: fixUrl(url) }}
                            style={styles.reportImage}
                            resizeMode="cover"
                          />
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Video Action */}
                {selectedReport.video_url && (
                  <TouchableOpacity
                    style={styles.videoButtonLarge}
                    onPress={() => openVideo(selectedReport.video_url)}
                  >
                    <FontAwesome name="play-circle" size={32} color="white" />
                    <Text style={styles.videoButtonText}>Xem Video Mô Phỏng</Text>
                  </TouchableOpacity>
                )}

              </ScrollView>
            ) : (
              <View style={styles.centerContent}>
                <ActivityIndicator size="large" color={THEME.colors.accent} />
              </View>
            )}
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  header: {
    paddingHorizontal: THEME.spacing.m,
    paddingVertical: THEME.spacing.s,
    backgroundColor: THEME.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 10,
  },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitleContainer: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: THEME.colors.text },
  statusIndicator: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ade80', marginRight: 4 },
  statusText: { fontSize: 12, color: THEME.colors.textSecondary },
  chatContainer: { flex: 1 },
  messagesList: { padding: THEME.spacing.m, paddingBottom: 20 },
  messageRow: { flexDirection: 'row', marginBottom: THEME.spacing.m, alignItems: 'flex-end' },
  messageRowUser: { justifyContent: 'flex-end' },
  messageRowBot: { justifyContent: 'flex-start' },
  avatarContainer: { marginRight: 8 },
  avatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  messageBubble: { maxWidth: '75%', padding: 12, borderRadius: THEME.borderRadius.m, elevation: 2 },
  messageBubbleUser: { borderBottomRightRadius: 4 },
  messageBubbleBot: { backgroundColor: THEME.colors.botMessage, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: THEME.colors.border },
  messageTextUser: { color: 'white', fontSize: 16, lineHeight: 22 },
  messageTextBot: { color: THEME.colors.text, fontSize: 16, lineHeight: 22 },
  timeTextUser: { fontSize: 10, color: 'rgba(255, 255, 255, 0.7)', alignSelf: 'flex-end', marginTop: 4 },
  timeTextBot: { fontSize: 10, color: THEME.colors.textSecondary, alignSelf: 'flex-end', marginTop: 4 },
  inputWrapper: { backgroundColor: THEME.colors.background, borderTopWidth: 1, borderTopColor: THEME.colors.border },
  inputContainer: { flexDirection: 'row', alignItems: 'center', padding: THEME.spacing.m, gap: 10 },
  input: { flex: 1, backgroundColor: THEME.colors.inputBg, borderRadius: 25, paddingHorizontal: 20, paddingVertical: 10, color: THEME.colors.text, fontSize: 16, maxHeight: 100, borderWidth: 1, borderColor: THEME.colors.border },
  sendButtonContainer: { borderRadius: 25, overflow: 'hidden' },
  sendButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  suggestionsContainer: { backgroundColor: THEME.colors.background, paddingVertical: 8 },
  suggestionChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.colors.secondary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: THEME.colors.border },
  suggestionText: { color: THEME.colors.textSecondary, fontSize: 12 },
  actionButtons: { marginTop: 10, flexDirection: 'row', gap: 10 },
  actionButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10b981', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  actionButtonText: { color: 'white', fontSize: 12, marginLeft: 6, fontWeight: 'bold' },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#f8fafc', borderRadius: 12, flex: 1, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: 'white' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  reportScroll: { flex: 1 },
  infoCard: { backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  infoTitle: { fontSize: 16, fontWeight: 'bold', color: '#334155', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  infoLabel: { color: '#64748b', fontSize: 14 },
  infoValue: { color: '#0f172a', fontSize: 14, fontWeight: '500' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#334155', marginBottom: 10 },
  sectionText: { color: '#475569', fontSize: 14, lineHeight: 22, backgroundColor: 'white', padding: 12, borderRadius: 8 },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  imageWrapper: { width: '48%', aspectRatio: 1, borderRadius: 8, overflow: 'hidden', backgroundColor: '#e2e8f0' },
  reportImage: { width: '100%', height: '100%' },
  videoButtonLarge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#3b82f6', padding: 16, borderRadius: 12, marginTop: 10 },
  videoButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold', marginLeft: 10 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  attachButton: { padding: 8, justifyContent: 'center', alignItems: 'center' },
});
