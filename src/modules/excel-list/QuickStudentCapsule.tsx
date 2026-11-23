import React, { useEffect, useRef, useState } from 'react';
import { useAddStudentsBatchMutation } from '../../system/query/useStudioQueries';
import { studentInputSchema } from '../../system/schemas/studioSchemas';
import type { ClassRecord } from '../../system/sqlite/types';
import { SheetAutoIcon } from '../../window-system/sheet/SheetFieldIcons';
import { formErrorMessage, isTeacherClassName } from './sheets/formHelpers';

/**
 * İZOLE MODÜL 01 ALT BİLEŞENİ: Seri Öğrenci / Öğretmen Kayıt Kapsülü
 * - Öğrenci şubesinde: Okul No + Adı + Soyadı
 * - Öğretmen kadrosunda: Okul No sormaz; Adı + Soyadı + Görevi
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */
export const QuickStudentCapsule: React.FC<{
  activeClass: ClassRecord;
  onAdded?: (studentNumber: string) => void;
  onNotice: (msg: string | null) => void;
}> = React.memo(({ activeClass, onAdded, onNotice }) => {
  const addMut = useAddStudentsBatchMutation();
  const isStaff = isTeacherClassName(activeClass.name);
  const [studentNumber, setStudentNumber] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('');
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setStudentNumber('');
    setFirstName('');
    setLastName('');
    setRole('');
  }, [activeClass.id, isStaff]);

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    onNotice(null);
    const numToUse = isStaff ? '0' : studentNumber.trim();
    const parsed = studentInputSchema.safeParse({
      studentNumber: numToUse,
      firstName,
      lastName,
      role: isStaff ? role : '',
    });
    if (!parsed.success) {
      onNotice(parsed.error.issues[0]?.message ?? 'Kayıt bilgileri geçersiz.');
      return;
    }
    try {
      await addMut.mutateAsync({
        classId: activeClass.id,
        rows: [parsed.data],
      });
      setStudentNumber('');
      setFirstName('');
      setLastName('');
      setRole('');
      onAdded?.(parsed.data.studentNumber);
      firstInputRef.current?.focus();
    } catch (err) {
      onNotice(formErrorMessage(err));
    }
  };

  return (
    <form className="xl-quick-capsule" onSubmit={handleQuickAdd}>
      {!isStaff && (
        <input
          ref={firstInputRef}
          type="text"
          className="xl-quick-input xl-quick-input-no"
          aria-label="Okul numarası"
          placeholder="Okul No"
          maxLength={15}
          value={studentNumber}
          onChange={(e) => setStudentNumber(e.target.value)}
        />
      )}
      <input
        ref={isStaff ? firstInputRef : undefined}
        type="text"
        className="xl-quick-input"
        aria-label={isStaff ? 'Öğretmen adı' : 'Ad'}
        placeholder={isStaff ? 'Öğretmen Adı' : 'Adı'}
        maxLength={60}
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
      />
      <input
        type="text"
        className={`xl-quick-input ${!isStaff ? 'xl-quick-input-last' : ''}`.trim()}
        aria-label="Soyad"
        placeholder="Soyadı"
        maxLength={60}
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
      />
      {isStaff && (
        <input
          type="text"
          className="xl-quick-input xl-quick-input-last"
          aria-label="Görevi"
          placeholder="Görevi / Branşı"
          maxLength={60}
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />
      )}
      <button
        type="submit"
        className="xl-quick-submit"
        disabled={addMut.isPending}
      >
        <SheetAutoIcon text="Hızlı Ekle" size={12.5} />
        {isStaff ? 'Hızlı Kaydet' : 'Hızlı Ekle'}
      </button>
    </form>
  );
});
