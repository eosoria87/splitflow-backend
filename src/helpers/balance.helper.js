/**
 * Balance Helper
 * Handles balance calculation and debt optimization algorithms
 * 
 * SOLID Principles:
 * - Single Responsibility: Only handles balance/settlement calculations
 * - Open/Closed: Easy to extend with new optimization algorithms
 */
class BalanceHelper {
  
  /**
   * Calculate net balances for all members in a group
   * @param {Array} expenses - Array of expense objects with participants
   * @param {Array} members - Array of group members
   * @returns {Array} - Array of {userId, netBalance, paid, owes}
   */
  static calculateBalances(expenses, members) {
    // Initialize balances for all members
    const balances = {};
    
    members.forEach(member => {
      balances[member.user_id] = {
        userId: member.user_id,
        name: member.profiles?.name || 'Unknown',
        email: member.profiles?.email || '',
        paid: 0,      // Total amount this person paid
        owes: 0,      // Total amount this person owes
        netBalance: 0 // paid - owes (positive = owed money, negative = owes money)
      };
    });

    // Calculate paid and owes for each member
    expenses.forEach(expense => {
      const amount = parseFloat(expense.amount);
      const paidBy = expense.paid_by;

      // Add to amount paid by payer
      if (balances[paidBy]) {
        balances[paidBy].paid += amount;
      }

      // Add share to each participant's owes
      expense.participants.forEach(participant => {
        const userId = participant.user_id;
        const share = parseFloat(participant.share);

        if (balances[userId]) {
          balances[userId].owes += share;
        }
      });
    });

    // Calculate net balance for each member
    Object.keys(balances).forEach(userId => {
      balances[userId].netBalance = parseFloat(
        (balances[userId].paid - balances[userId].owes).toFixed(2)
      );
    });

    // Convert to array and sort by net balance (descending)
    return Object.values(balances).sort((a, b) => b.netBalance - a.netBalance);
  }

  /**
   * Optimize settlements using greedy algorithm
   * Minimizes the number of transactions needed to settle all debts
   * 
   * @param {Array} balances - Array of balance objects from calculateBalances()
   * @returns {Array} - Array of settlement suggestions {from, to, amount}
   */
  static optimizeSettlements(balances) {
    // Separate creditors (people who are owed) and debtors (people who owe)
    const creditors = balances
      .filter(b => b.netBalance > 0.01) // Use 0.01 to handle floating point
      .map(b => ({ ...b, remaining: b.netBalance }))
      .sort((a, b) => b.remaining - a.remaining);

    const debtors = balances
      .filter(b => b.netBalance < -0.01)
      .map(b => ({ ...b, remaining: Math.abs(b.netBalance) }))
      .sort((a, b) => b.remaining - a.remaining);

    const settlements = [];

    let i = 0; // Index for debtors
    let j = 0; // Index for creditors

    // Greedy algorithm: match largest debtor with largest creditor
    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];

      // Determine settlement amount (minimum of what debtor owes and creditor is owed)
      const amount = Math.min(debtor.remaining, creditor.remaining);

      // Only create settlement if amount is significant (> 0.01)
      if (amount > 0.01) {
        settlements.push({
          from: debtor.userId,
          from_name: debtor.name,
          from_email: debtor.email,
          to: creditor.userId,
          to_name: creditor.name,
          to_email: creditor.email,
          amount: parseFloat(amount.toFixed(2))
        });
      }

      // Update remaining amounts
      debtor.remaining -= amount;
      creditor.remaining -= amount;

      // Move to next debtor/creditor if current one is settled
      if (debtor.remaining < 0.01) i++;
      if (creditor.remaining < 0.01) j++;
    }

    return settlements;
  }

  /**
   * Calculate balance summary statistics
   * @param {Array} balances - Array of balance objects
   * @returns {Object} - Summary statistics
   */
  static getBalanceSummary(balances) {
    const totalPaid = balances.reduce((sum, b) => sum + b.paid, 0);
    const totalOwed = balances.filter(b => b.netBalance > 0)
      .reduce((sum, b) => sum + b.netBalance, 0);
    const totalDebt = balances.filter(b => b.netBalance < 0)
      .reduce((sum, b) => sum + Math.abs(b.netBalance), 0);

    return {
      totalPaid: parseFloat(totalPaid.toFixed(2)),
      totalOwed: parseFloat(totalOwed.toFixed(2)),
      totalDebt: parseFloat(totalDebt.toFixed(2)),
      isBalanced: Math.abs(totalOwed - totalDebt) < 0.01,
      memberCount: balances.length
    };
  }

  /**
   * Validate settlement suggestion
   * Ensures the settlement makes sense given current balances
   * @param {Object} settlement - Settlement object {from, to, amount}
   * @param {Array} balances - Current balances
   * @returns {boolean} - Whether settlement is valid
   */
  static validateSettlement(settlement, balances) {
    const debtor = balances.find(b => b.userId === settlement.from);
    const creditor = balances.find(b => b.userId === settlement.to);

    if (!debtor || !creditor) return false;
    if (debtor.netBalance >= 0) return false; // Debtor doesn't owe money
    if (creditor.netBalance <= 0) return false; // Creditor isn't owed money
    if (settlement.amount <= 0) return false;
    if (settlement.amount > Math.abs(debtor.netBalance) + 0.01) return false;
    if (settlement.amount > creditor.netBalance + 0.01) return false;

    return true;
  }
}

module.exports = BalanceHelper;