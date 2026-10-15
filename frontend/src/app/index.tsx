import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Employee = {
  id: string;
  name: string;
  position: string;
  status: 'Active' | 'On Leave';
  salary: number;
};

type SalaryCluster = {
  group: string;
  centroid: number;
  count: number;
};

type ApiError = {
  message?: string;
};

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const FONT_FAMILY = Platform.select({
  web: '"Noto Sans Thai", "Leelawadee UI", Tahoma, sans-serif',
  default: undefined,
});
const DISPLAY_FONT = Platform.select({
  web: 'Georgia, "Noto Serif Thai", Tahoma, serif',
  default: 'serif',
});
const palette = {
  paper: '#E9E6F5',
  ivory: '#F8F6FF',
  card: '#FFFEFA',
  forest: '#292548',
  forestLight: '#6556B5',
  forestPale: '#EAE6FA',
  gold: '#E47D9B',
  goldPale: '#FFE3EC',
  ink: '#292548',
  muted: '#696781',
  softMuted: '#9793AA',
  border: '#D6D0E9',
  red: '#B24C64',
};

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error('เซิร์ฟเวอร์ส่งข้อมูลกลับมาไม่ถูกต้อง');
  }

  if (!response.ok) {
    const error = result as ApiError;
    throw new Error(error.message || `เกิดข้อผิดพลาด (${response.status})`);
  }

  return result as T;
}

function formatSalary(amount: number) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(amount);
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default function HomeScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const isCompactScreen = screenWidth < 720;
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clusters, setClusters] = useState<SalaryCluster[]>([]);
  const [loginError, setLoginError] = useState('');
  const [pageError, setPageError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formName, setFormName] = useState('');
  const [formPosition, setFormPosition] = useState('');
  const [formSalary, setFormSalary] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const loadDashboard = async () => {
    setLoading(true);
    setPageError('');
    try {
      const [employeeList, clusterResult] = await Promise.all([
        apiRequest<Employee[]>('/api/employees'),
        apiRequest<{ success: boolean; clusters: SalaryCluster[] }>(
          '/api/employees/salary-clusters'
        ),
      ]);
      setEmployees(employeeList);
      setClusters(clusterResult.clusters);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoginError('');
    setLoginLoading(true);
    try {
      const result = await apiRequest<{ success: boolean; token: string }>('/api/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      setToken(result.token);
      await loadDashboard();
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setLoginLoading(false);
    }
  };

  const openCreateForm = () => {
    setEditingEmployee(null);
    setFormName('');
    setFormPosition('');
    setFormSalary('');
    setFormError('');
    setFormVisible(true);
  };

  const openEditForm = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormName(employee.name);
    setFormPosition(employee.position);
    setFormSalary(String(employee.salary));
    setFormError('');
    setFormVisible(true);
  };

  const saveEmployee = async () => {
    const salary = Number(formSalary);
    if (!formName.trim() || !formPosition.trim() || !formSalary.trim() || !Number.isFinite(salary)) {
      setFormError('กรุณากรอกชื่อ ตำแหน่ง และเงินเดือนให้ครบถ้วน');
      return;
    }
    if (salary < 0) {
      setFormError('เงินเดือนต้องเป็นจำนวนตั้งแต่ 0 ขึ้นไป');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const isEditing = editingEmployee !== null;
      await apiRequest<Employee>(
        isEditing ? `/api/employees/${editingEmployee.id}` : '/api/employees',
        {
          method: isEditing ? 'PUT' : 'POST',
          body: JSON.stringify({
            name: formName.trim(),
            position: formPosition.trim(),
            salary,
          }),
        }
      );
      setFormVisible(false);
      await loadDashboard();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'บันทึกข้อมูลไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (employee: Employee) => {
    setPageError('');
    try {
      await apiRequest<Employee>(`/api/employees/${employee.id}/status`, {
        method: 'PUT',
      });
      await loadDashboard();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'เปลี่ยนสถานะไม่สำเร็จ');
    }
  };

  const deleteEmployee = async (employee: Employee) => {
    const remove = async () => {
      setPageError('');
      try {
        await apiRequest<{ success: boolean }>(`/api/employees/${employee.id}`, {
          method: 'DELETE',
        });
        await loadDashboard();
      } catch (error) {
        setPageError(error instanceof Error ? error.message : 'ลบข้อมูลไม่สำเร็จ');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`ต้องการลบ ${employee.name} หรือไม่?`)) {
        await remove();
      }
      return;
    }

    Alert.alert('ยืนยันการลบ', `ต้องการลบ ${employee.name} หรือไม่?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ลบพนักงาน', style: 'destructive', onPress: () => void remove() },
    ]);
  };

  const logout = () => {
    setToken('');
    setEmployees([]);
    setClusters([]);
    setPassword('');
  };

  if (!token) {
    return (
      <SafeAreaView style={styles.loginSafeArea}>
        <ScrollView
          contentContainerStyle={styles.loginPage}
          keyboardShouldPersistTaps="handled">
          <View style={[styles.loginLayout, isCompactScreen && styles.loginLayoutCompact]}>
            <View style={[styles.loginIntro, isCompactScreen && styles.loginIntroCompact]}>
              <View style={styles.loginMasthead}>
                <View style={styles.brandMark}>
                  <Text style={styles.brandMarkText}>P</Text>
                </View>
                <View>
                  <Text style={styles.mastheadName}>PEOPLEOPS</Text>
                  <Text style={styles.eyebrowLight}>HR CONTROL ROOM · 1996</Text>
                </View>
              </View>
              <View style={styles.heroRule}>
                <View style={styles.heroRuleAccent} />
                <View style={styles.heroRuleLine} />
                <Text style={styles.heroRuleNumber}>NO. 01</Text>
              </View>
              <Text style={styles.loginTitle}>ดูแลทีมงาน{'\n'}เห็นภาพรวม</Text>
              <Text style={styles.loginDescription}>
                ศูนย์ควบคุมข้อมูลบุคลากรและค่าตอบแทน สำหรับการตัดสินใจที่มั่นใจในทุกวัน
              </Text>
              <View style={styles.loginNote}>
                <Text style={styles.loginNoteIcon}>✳</Text>
                <Text style={styles.loginNoteText}>PEOPLE · PAYROLL · PERFORMANCE</Text>
              </View>
              <View style={styles.pixelDecoration}>
                <View style={[styles.pixel, styles.pixelOne]} />
                <View style={[styles.pixel, styles.pixelTwo]} />
                <View style={[styles.pixel, styles.pixelThree]} />
                <View style={[styles.pixel, styles.pixelFour]} />
              </View>
            </View>

            <View style={[styles.loginCard, isCompactScreen && styles.loginCardCompact]}>
              <Text style={styles.eyebrow}>MEMBER ACCESS / 01</Text>
              <Text style={styles.loginCardTitle}>เข้าสู่ระบบ</Text>
              <Text style={styles.mutedText}>ยินดีต้อนรับกลับ กรุณากรอกข้อมูลเพื่อเข้าสู่ระบบ</Text>

              <Text style={styles.inputLabel}>ชื่อผู้ใช้</Text>
              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder="เช่น admin"
                placeholderTextColor={palette.softMuted}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
                onSubmitEditing={handleLogin}
              />
              <Text style={styles.inputLabel}>รหัสผ่าน</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="กรอกรหัสผ่าน"
                placeholderTextColor={palette.softMuted}
                secureTextEntry
                style={styles.input}
                onSubmitEditing={handleLogin}
              />

              {loginError ? <Text style={styles.errorText}>{loginError}</Text> : null}
              <Pressable
                onPress={handleLogin}
                disabled={loginLoading}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.pressed,
                  loginLoading && styles.disabledButton,
                ]}>
                {loginLoading ? (
                  <ActivityIndicator color={palette.goldPale} />
                ) : (
                  <Text style={styles.primaryButtonText}>เข้าสู่ระบบ</Text>
                )}
              </Pressable>
              <Text style={styles.loginHint}>ทดลองใช้: admin / password123</Text>
            </View>
          </View>
          <Text style={styles.footerText}>PEOPLEOPS · HR &amp; SALARY ANALYTICS</Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const activeCount = employees.filter((employee) => employee.status === 'Active').length;
  const averageSalary = employees.length
    ? employees.reduce((sum, employee) => sum + employee.salary, 0) / employees.length
    : 0;
  const filteredEmployees = employees.filter((employee) => {
    const query = search.trim().toLowerCase();
    return (
      employee.name.toLowerCase().includes(query) ||
      employee.position.toLowerCase().includes(query)
    );
  });

  return (
    <SafeAreaView style={styles.dashboardPage}>
      <View style={styles.topBar}>
        <View style={styles.topBarInner}>
          <View style={styles.topBrand}>
            <View style={styles.smallBrandMark}>
              <Text style={styles.smallBrandMarkText}>P</Text>
            </View>
            <View>
              <Text style={styles.brandName}>PeopleOps</Text>
              <Text style={styles.brandCaption}>HR MANAGEMENT</Text>
            </View>
          </View>
          <View style={styles.topBarRight}>
            <View style={styles.accountBadge}>
              <View style={styles.accountAvatar}>
                <Text style={styles.accountAvatarText}>HR</Text>
              </View>
              <Text style={styles.accountName}>HR Manager</Text>
            </View>
            <Pressable onPress={logout} style={styles.logoutButton}>
              <Text style={styles.logoutText}>ออกจากระบบ</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.dashboardContent}>
        <View style={styles.pageHeading}>
          <View>
            <Text style={styles.eyebrow}>SYSTEM 01 / PEOPLE OPS</Text>
            <Text style={styles.pageTitle}>ภาพรวมบุคลากร</Text>
            <Text style={styles.mutedText}>จัดการทีม · ติดตามสถานะ · วิเคราะห์ค่าตอบแทน</Text>
          </View>
          <Pressable
            onPress={openCreateForm}
            style={({ pressed }) => [styles.primaryButton, styles.addButton, pressed && styles.pressed]}>
            <Text style={styles.addButtonText}>＋ เพิ่มสมาชิกทีม</Text>
          </Pressable>
        </View>

        {pageError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{pageError}</Text>
            <Pressable onPress={loadDashboard}>
              <Text style={styles.retryText}>ลองอีกครั้ง</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.metricGrid}>
          <MetricCard label="พนักงานทั้งหมด" value={String(employees.length)} detail="บุคลากรในระบบ" accent={palette.forestLight} />
          <MetricCard label="กำลังปฏิบัติงาน" value={String(activeCount)} detail="สถานะ Active" accent="#65836D" />
          <MetricCard label="เงินเดือนเฉลี่ย" value={formatSalary(averageSalary)} detail="ต่อเดือน" accent={palette.gold} />
          <MetricCard label="อยู่ระหว่างลา" value={String(employees.length - activeCount)} detail="สถานะ On Leave" accent="#927862" />
        </View>

        <View style={styles.analyticsPanel}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.panelTitle}>วิเคราะห์ช่วงเงินเดือน</Text>
              <Text style={styles.mutedText}>จัดกลุ่มเงินเดือนด้วย K-Means · 3 ระดับ</Text>
            </View>
            <Text style={styles.analyticsTag}>SALARY INSIGHTS</Text>
          </View>
          <View style={styles.clusterGrid}>
            {clusters.map((cluster, index) => (
              <View key={cluster.group} style={styles.clusterCard}>
                <View style={[styles.clusterDot, { backgroundColor: tierColors[index % tierColors.length] }]} />
                <View style={styles.clusterInfo}>
                  <Text style={styles.clusterLabel}>{cluster.group}</Text>
                  <Text style={styles.clusterSalary}>{formatSalary(cluster.centroid)}</Text>
                  <Text style={styles.clusterCount}>{cluster.count} คน · เงินเดือนเฉลี่ยของกลุ่ม</Text>
                </View>
              </View>
            ))}
            {!clusters.length && !loading ? (
              <Text style={styles.mutedText}>ยังไม่มีข้อมูลสำหรับวิเคราะห์</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.employeePanel}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.panelTitle}>รายชื่อพนักงาน</Text>
              <Text style={styles.mutedText}>TEAM DIRECTORY · {employees.length} RECORDS</Text>
            </View>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="ค้นหาชื่อหรือตำแหน่ง..."
              placeholderTextColor={palette.softMuted}
              style={[styles.input, styles.searchInput]}
            />
          </View>

          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color={palette.forestLight} />
              <Text style={styles.mutedText}>กำลังโหลดข้อมูล...</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View style={styles.table}>
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <Text style={[styles.tableHeaderText, styles.personColumn]}>พนักงาน</Text>
                  <Text style={[styles.tableHeaderText, styles.positionColumn]}>ตำแหน่ง</Text>
                  <Text style={[styles.tableHeaderText, styles.statusColumn]}>สถานะ</Text>
                  <Text style={[styles.tableHeaderText, styles.salaryColumn]}>เงินเดือน / เดือน</Text>
                  <Text style={[styles.tableHeaderText, styles.actionsColumn]}>จัดการ</Text>
                </View>
                {filteredEmployees.map((employee) => (
                  <View key={employee.id} style={styles.tableRow}>
                    <View style={[styles.personCell, styles.personColumn]}>
                      <View style={styles.personAvatar}>
                        <Text style={styles.personAvatarText}>{initials(employee.name)}</Text>
                      </View>
                      <Text numberOfLines={1} style={styles.personName}>{employee.name}</Text>
                    </View>
                    <Text numberOfLines={1} style={[styles.tableCell, styles.positionColumn]}>
                      {employee.position}
                    </Text>
                    <View style={[styles.statusColumn, styles.statusCell]}>
                      <View
                        style={[
                          styles.statusPill,
                          employee.status === 'Active' ? styles.activePill : styles.leavePill,
                        ]}>
                        <View
                          style={[
                            styles.statusDot,
                            employee.status === 'Active' ? styles.activeDot : styles.leaveDot,
                          ]}
                        />
                        <Text
                          style={[
                            styles.statusText,
                            employee.status === 'Active' ? styles.activeText : styles.leaveText,
                          ]}>
                          {employee.status === 'Active' ? 'ปฏิบัติงาน' : 'อยู่ระหว่างลา'}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.salaryCell, styles.salaryColumn]}>{formatSalary(employee.salary)}</Text>
                    <View style={[styles.actionCell, styles.actionsColumn]}>
                      <Pressable onPress={() => toggleStatus(employee)} style={styles.textAction}>
                        <Text style={styles.statusActionText}>เปลี่ยนสถานะ</Text>
                      </Pressable>
                      <Pressable onPress={() => openEditForm(employee)} style={styles.textAction}>
                        <Text style={styles.editActionText}>แก้ไข</Text>
                      </Pressable>
                      <Pressable onPress={() => void deleteEmployee(employee)} style={styles.textAction}>
                        <Text style={styles.deleteActionText}>ลบ</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
                {!filteredEmployees.length ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.mutedText}>
                      {employees.length ? 'ไม่พบพนักงานที่ค้นหา' : 'ยังไม่มีข้อมูลพนักงาน'}
                    </Text>
                  </View>
                ) : null}
              </View>
            </ScrollView>
          )}
        </View>
        <Text style={styles.dashboardFooter}>PEOPLEOPS · HR &amp; SALARY ANALYTICS</Text>
      </ScrollView>

      <Modal
        visible={formVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFormVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.formCard}>
            <View style={styles.formHeading}>
              <View>
                <Text style={styles.eyebrow}>{editingEmployee ? 'EDIT PROFILE' : 'NEW TEAM MEMBER'}</Text>
                <Text style={styles.panelTitle}>
                  {editingEmployee ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงาน'}
                </Text>
              </View>
              <Pressable onPress={() => setFormVisible(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>×</Text>
              </Pressable>
            </View>
            <Text style={styles.inputLabel}>ชื่อ-นามสกุล</Text>
            <TextInput
              value={formName}
              onChangeText={setFormName}
              placeholder="ระบุชื่อพนักงาน"
              placeholderTextColor={palette.softMuted}
              style={styles.input}
            />
            <Text style={styles.inputLabel}>ตำแหน่ง</Text>
            <TextInput
              value={formPosition}
              onChangeText={setFormPosition}
              placeholder="ระบุตำแหน่งงาน"
              placeholderTextColor={palette.softMuted}
              style={styles.input}
            />
            <Text style={styles.inputLabel}>เงินเดือนต่อเดือน (บาท)</Text>
            <TextInput
              value={formSalary}
              onChangeText={setFormSalary}
              placeholder="เช่น 45000"
              placeholderTextColor={palette.softMuted}
              keyboardType="decimal-pad"
              style={styles.input}
            />
            {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
            <View style={styles.formActions}>
              <Pressable onPress={() => setFormVisible(false)} style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>ยกเลิก</Text>
              </Pressable>
              <Pressable
                onPress={saveEmployee}
                disabled={saving}
                style={({ pressed }) => [
                  styles.primaryButton,
                  styles.saveButton,
                  pressed && styles.pressed,
                  saving && styles.disabledButton,
                ]}>
                {saving ? (
                  <ActivityIndicator color={palette.ivory} />
                ) : (
                  <Text style={styles.primaryButtonText}>บันทึกข้อมูล</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const tierColors = [palette.forestLight, palette.gold, '#927862'];

function MetricCard({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  accent: string;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricAccent, { backgroundColor: accent }]} />
      <Text style={styles.metricLabel}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loginSafeArea: {
    flex: 1,
    backgroundColor: palette.paper,
  },
  loginPage: {
    flexGrow: 1,
    width: '100%',
    minHeight: '100%',
    backgroundColor: palette.paper,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 36,
    fontFamily: FONT_FAMILY,
  },
  loginLayoutCompact: {
    flexDirection: 'column',
  },
  loginLayout: {
    width: '100%',
    maxWidth: 1040,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: palette.card,
    borderWidth: 2,
    borderColor: palette.ink,
    ...Platform.select({
      web: { boxShadow: '9px 9px 0 #B9B1D5' },
      default: { elevation: 8 },
    }),
  },
  loginIntro: {
    flex: 1,
    flexBasis: 360,
    minHeight: 500,
    paddingHorizontal: 48,
    paddingVertical: 46,
    paddingBottom: 92,
    justifyContent: 'center',
    backgroundColor: palette.forest,
    overflow: 'hidden',
  },
  loginIntroCompact: {
    minHeight: 0,
    paddingHorizontal: 25,
    paddingVertical: 27,
    paddingBottom: 74,
  },
  loginMasthead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginBottom: 26,
  },
  mastheadName: {
    color: '#F8F6FF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.2,
    fontFamily: FONT_FAMILY,
  },
  eyebrowLight: {
    color: '#BDB6E2',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.3,
    marginTop: 5,
    fontFamily: FONT_FAMILY,
  },
  heroRule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  heroRuleAccent: {
    width: 8,
    height: 8,
    backgroundColor: palette.gold,
  },
  heroRuleLine: {
    width: 44,
    height: 1,
    backgroundColor: '#8179AA',
  },
  heroRuleNumber: {
    color: '#BDB6E2',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.4,
    fontFamily: FONT_FAMILY,
  },
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 2,
    borderWidth: 2,
    borderColor: palette.ink,
    backgroundColor: palette.goldPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: {
    color: palette.forest,
    fontSize: 22,
    fontWeight: '800',
    fontFamily: FONT_FAMILY,
  },
  loginTitle: {
    color: palette.ivory,
    fontSize: 36,
    lineHeight: 50,
    fontWeight: '700',
    letterSpacing: 0,
    fontFamily: DISPLAY_FONT,
  },
  loginDescription: {
    color: '#D9D4EE',
    fontSize: 14,
    lineHeight: 25,
    marginTop: 14,
    maxWidth: 390,
    fontFamily: FONT_FAMILY,
  },
  loginNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 48,
  },
  loginNoteIcon: {
    color: '#F2C76B',
    fontSize: 18,
    fontFamily: FONT_FAMILY,
  },
  loginNoteText: {
    color: '#CDC7E4',
    fontSize: 9,
    letterSpacing: 1,
    fontFamily: FONT_FAMILY,
  },
  pixelDecoration: {
    position: 'absolute',
    right: 26,
    bottom: 20,
    width: 72,
    height: 50,
  },
  pixel: {
    position: 'absolute',
    width: 12,
    height: 12,
  },
  pixelOne: {
    right: 0,
    top: 0,
    backgroundColor: '#E47D9B',
  },
  pixelTwo: {
    right: 16,
    top: 16,
    backgroundColor: '#F2C76B',
  },
  pixelThree: {
    right: 32,
    top: 0,
    backgroundColor: '#6CC7C1',
  },
  pixelFour: {
    right: 48,
    top: 16,
    backgroundColor: '#8D80D2',
  },
  loginCard: {
    flex: 1,
    flexBasis: 360,
    paddingHorizontal: 48,
    paddingVertical: 48,
    justifyContent: 'center',
    backgroundColor: palette.card,
  },
  loginCardCompact: {
    paddingHorizontal: 25,
    paddingVertical: 30,
  },
  eyebrow: {
    color: palette.forestLight,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 10,
    fontFamily: FONT_FAMILY,
  },
  loginCardTitle: {
    color: palette.ink,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 0,
    marginBottom: 8,
    fontFamily: DISPLAY_FONT,
  },
  mutedText: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: FONT_FAMILY,
  },
  inputLabel: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 22,
    marginBottom: 8,
    fontFamily: FONT_FAMILY,
  },
  input: {
    height: 48,
    borderWidth: 2,
    borderColor: palette.border,
    borderRadius: 2,
    paddingHorizontal: 13,
    color: palette.ink,
    fontSize: 13,
    backgroundColor: palette.ivory,
    fontFamily: FONT_FAMILY,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 2,
    borderWidth: 2,
    borderColor: palette.ink,
    backgroundColor: palette.forestLight,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONT_FAMILY,
  },
  pressed: {
    opacity: 0.82,
  },
  disabledButton: {
    opacity: 0.65,
  },
  loginHint: {
    color: palette.softMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 16,
    fontFamily: FONT_FAMILY,
  },
  errorText: {
    color: palette.red,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
    fontFamily: FONT_FAMILY,
  },
  footerText: {
    color: palette.softMuted,
    fontSize: 9,
    letterSpacing: 1.5,
    marginTop: 28,
    fontWeight: '700',
    fontFamily: FONT_FAMILY,
  },
  dashboardPage: {
    flex: 1,
    minHeight: '100%',
    backgroundColor: palette.paper,
    fontFamily: FONT_FAMILY,
  },
  topBar: {
    backgroundColor: palette.ivory,
    borderBottomWidth: 2,
    borderBottomColor: palette.border,
    borderTopWidth: 5,
    borderTopColor: palette.forestLight,
  },
  topBarInner: {
    width: '100%',
    maxWidth: 1200,
    minHeight: 72,
    alignSelf: 'center',
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  smallBrandMark: {
    width: 36,
    height: 36,
    borderRadius: 2,
    borderWidth: 2,
    borderColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.forest,
  },
  smallBrandMarkText: {
    color: '#EAD7AE',
    fontSize: 18,
    fontWeight: '800',
    fontFamily: FONT_FAMILY,
  },
  brandName: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: DISPLAY_FONT,
  },
  brandCaption: {
    color: palette.softMuted,
    fontSize: 8,
    letterSpacing: 1.3,
    marginTop: 2,
    fontWeight: '700',
    fontFamily: FONT_FAMILY,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  accountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  accountAvatar: {
    width: 32,
    height: 32,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: palette.ink,
    backgroundColor: palette.goldPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountAvatarText: {
    color: palette.forest,
    fontSize: 10,
    fontWeight: '800',
    fontFamily: FONT_FAMILY,
  },
  accountName: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FONT_FAMILY,
  },
  logoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  logoutText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FONT_FAMILY,
  },
  dashboardContent: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    paddingHorizontal: 28,
    paddingTop: 34,
    paddingBottom: 30,
    gap: 20,
  },
  pageHeading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 2,
  },
  pageTitle: {
    color: palette.ink,
    fontSize: 31,
    letterSpacing: 0,
    fontWeight: '700',
    marginBottom: 5,
    fontFamily: DISPLAY_FONT,
  },
  addButton: {
    minHeight: 42,
  },
  addButtonText: {
    color: '#EAD7AE',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONT_FAMILY,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8EEEA',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#E6CFC4',
  },
  retryText: {
    color: palette.forestLight,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONT_FAMILY,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  metricCard: {
    flexGrow: 1,
    flexBasis: 200,
    minHeight: 130,
    backgroundColor: palette.card,
    borderRadius: 2,
    borderWidth: 2,
    borderColor: palette.border,
    paddingHorizontal: 18,
    paddingVertical: 17,
    overflow: 'hidden',
  },
  metricAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 5,
    height: '100%',
  },
  metricLabel: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '500',
    fontFamily: FONT_FAMILY,
  },
  metricValue: {
    color: palette.ink,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 11,
    fontVariant: ['tabular-nums'],
    fontFamily: DISPLAY_FONT,
  },
  metricDetail: {
    color: palette.softMuted,
    fontSize: 10,
    marginTop: 4,
    fontFamily: FONT_FAMILY,
  },
  analyticsPanel: {
    padding: 20,
    backgroundColor: palette.card,
    borderRadius: 2,
    borderWidth: 2,
    borderColor: palette.border,
  },
  sectionHeading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
  },
  panelTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    fontFamily: DISPLAY_FONT,
  },
  analyticsTag: {
    color: palette.forestLight,
    backgroundColor: palette.forestPale,
    borderRadius: 2,
    borderWidth: 2,
    borderColor: '#D5DED4',
    paddingHorizontal: 11,
    paddingVertical: 7,
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: '700',
    fontFamily: FONT_FAMILY,
  },
  clusterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  clusterCard: {
    flex: 1,
    flexBasis: 220,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    padding: 14,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 2,
    backgroundColor: palette.ivory,
  },
  clusterDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginTop: 5,
  },
  clusterInfo: {
    flex: 1,
  },
  clusterLabel: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '600',
    fontFamily: FONT_FAMILY,
  },
  clusterSalary: {
    color: palette.ink,
    fontSize: 19,
    fontWeight: '700',
    marginTop: 5,
    fontVariant: ['tabular-nums'],
    fontFamily: DISPLAY_FONT,
  },
  clusterCount: {
    color: palette.softMuted,
    fontSize: 10,
    marginTop: 4,
    fontFamily: FONT_FAMILY,
  },
  employeePanel: {
    paddingTop: 20,
    paddingBottom: 5,
    backgroundColor: palette.card,
    borderRadius: 2,
    borderWidth: 2,
    borderColor: palette.border,
    overflow: 'hidden',
  },
  searchInput: {
    width: 230,
    height: 38,
  },
  table: {
    minWidth: 900,
  },
  tableRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  tableHeader: {
    minHeight: 40,
    backgroundColor: '#EAE6FA',
  },
  tableHeaderText: {
    color: palette.forest,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
    fontFamily: FONT_FAMILY,
  },
  personColumn: {
    width: 235,
  },
  positionColumn: {
    width: 190,
  },
  statusColumn: {
    width: 150,
  },
  salaryColumn: {
    width: 170,
  },
  actionsColumn: {
    width: 180,
  },
  personCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 12,
  },
  personAvatar: {
    width: 34,
    height: 34,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.goldPale,
  },
  personAvatarText: {
    color: palette.forest,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: FONT_FAMILY,
  },
  personName: {
    flex: 1,
    color: palette.ink,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FONT_FAMILY,
  },
  tableCell: {
    color: palette.muted,
    fontSize: 11,
    paddingRight: 10,
    fontFamily: FONT_FAMILY,
  },
  statusCell: {
    alignItems: 'flex-start',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 2,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  activePill: {
    backgroundColor: '#E5F4F1',
  },
  leavePill: {
    backgroundColor: '#FFE8EF',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeDot: {
    backgroundColor: '#52A99F',
  },
  leaveDot: {
    backgroundColor: '#E47D9B',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: FONT_FAMILY,
  },
  activeText: {
    color: '#387D75',
  },
  leaveText: {
    color: '#A64E69',
  },
  salaryCell: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    fontFamily: FONT_FAMILY,
  },
  actionCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textAction: {
    paddingVertical: 7,
  },
  statusActionText: {
    color: palette.muted,
    fontSize: 10,
    fontWeight: '600',
    fontFamily: FONT_FAMILY,
  },
  editActionText: {
    color: palette.forestLight,
    fontSize: 10,
    fontWeight: '600',
    fontFamily: FONT_FAMILY,
  },
  deleteActionText: {
    color: palette.red,
    fontSize: 10,
    fontWeight: '600',
    fontFamily: FONT_FAMILY,
  },
  loadingState: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyState: {
    minHeight: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dashboardFooter: {
    color: palette.softMuted,
    fontSize: 9,
    letterSpacing: 1.3,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 8,
    fontFamily: FONT_FAMILY,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(28, 40, 32, 0.55)',
  },
  formCard: {
    width: '100%',
    maxWidth: 460,
    padding: 26,
    borderRadius: 2,
    borderWidth: 2,
    borderColor: palette.gold,
    backgroundColor: palette.card,
    ...Platform.select({
      web: { boxShadow: '7px 7px 0 #B9B1D5' },
      default: { elevation: 8 },
    }),
  },
  formHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 2,
    backgroundColor: palette.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: palette.muted,
    fontSize: 22,
    lineHeight: 24,
    fontFamily: FONT_FAMILY,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 24,
  },
  cancelButton: {
    minHeight: 44,
    paddingHorizontal: 17,
    borderRadius: 2,
    borderWidth: 2,
    borderColor: palette.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FONT_FAMILY,
  },
  saveButton: {
    minHeight: 44,
  },
});
