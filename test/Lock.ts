import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import xid from "xid-js";

describe("Vault", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function init() {
    const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
    const ONE_GWEI = 1_000_000_000;

    const lockedAmount = ONE_GWEI;
    const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;

    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await ethers.getSigners();

    const contract = await ethers.getContractFactory("Vault");
    const vault = await contract.deploy();

    // Token for testing
    const usdcContract = await ethers.getContractFactory("SampleToken");
    const usdc = await usdcContract.deploy("USDC Token", "USDC");
    const usdtContract = await ethers.getContractFactory("SampleToken");
    const usdt = await usdtContract.deploy("USDT Token", "USDT");

    // Distribute wealth
    await usdc.transfer(
      otherAccount.address,
      ethers.utils.parseEther("500000")
    );
    await usdt.transfer(
      otherAccount.address,
      ethers.utils.parseEther("500000")
    );

    return { vault, owner, otherAccount, usdt, usdc };
  }

  describe("Fee Setting", function () {
    it("Should set the fee", async function () {
      const { vault } = await loadFixture(init);
      await expect(vault.setFee(10)).not.to.be.reverted;
      expect(await vault.fee()).to.be.equal(10);
    });

    it("Should error set the fee", async function () {
      const { vault, otherAccount } = await loadFixture(init);
      await expect(
        vault.connect(otherAccount).setFee(10000)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should the same fee calculation", async function () {
      const { vault } = await loadFixture(init);
      await expect(vault.setFee(10)).not.to.be.reverted;

      expect(
        ethers.utils.formatEther(
          await vault.calculateFee(ethers.utils.parseEther("100"))
        )
      ).to.be.eq("1.0");
    });
  });

  describe("Tokens Setting", function () {
    it("Should can set token", async function () {
      const { vault, owner, usdc, usdt } = await loadFixture(init);
      await expect(vault.addTokens([usdc.address, usdt.address])).not.to.be
        .reverted;
      expect(await vault.tokens(usdc.address)).to.be.equal(true);
      expect(await vault.tokens(usdt.address)).to.be.equal(true);
      expect(await vault.tokens(owner.address)).to.be.equal(false);
    });

    it("Should cannot set token", async function () {
      const { vault, otherAccount, usdc, usdt } = await loadFixture(init);
      await expect(
        vault.connect(otherAccount).addTokens([usdc.address, usdt.address])
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  // describe.only("Address Byte32", function () {
  //   it.only("Should the same ", async function () {
  //     const { vault, owner, usdc, usdt } = await loadFixture(init);
  //
  //     for (let i = 0; i < 10; i++) {
  //       const b = ethers.utils.formatBytes32String(xid.next()).substring(0, 42);
  //       console.log(b);
  //     }
  //   });
  // });

  describe("Create Locker", function () {
    it("should error token ", async function () {
      const { vault, usdc, usdt } = await loadFixture(init);
      const b = ethers.utils.formatBytes32String(xid.next()).substring(0, 42);
      await expect(
        vault.create(b, usdt.address, ethers.utils.parseEther("100.0"))
      ).to.be.revertedWith("Token: Not valid Token");
    });

    it("should create locker", async function () {
      const { vault, usdc, usdt } = await loadFixture(init);
      const b = ethers.utils.formatBytes32String(xid.next()).substring(0, 42);

      await expect(vault.addTokens([usdc.address, usdt.address])).not.to.be
        .reverted;

      await usdt.approve(vault.address, ethers.utils.parseEther("100000"));

      await expect(
        vault.create(b, usdt.address, ethers.utils.parseEther("100.0"))
      ).not.to.be.reverted;

      const locker = await vault.lockers(b);
      expect(ethers.utils.formatEther(locker.totalBalance)).to.be.equal(
        "100.0"
      );
    });

    it("should can deposit locker", async function () {
      const { vault, usdc, usdt, otherAccount } = await loadFixture(init);
      const b = ethers.utils.formatBytes32String(xid.next()).substring(0, 42);

      await expect(vault.addTokens([usdc.address, usdt.address])).not.to.be
        .reverted;

      await usdt.approve(vault.address, ethers.utils.parseEther("100000"));

      await expect(
        vault.create(b, usdt.address, ethers.utils.parseEther("100.0"))
      ).not.to.be.reverted;

      await usdt
        .connect(otherAccount)
        .approve(vault.address, ethers.utils.parseEther("100000"));
      await expect(vault.connect(otherAccount).depositLocker(b)).not.to.be
        .reverted;
      const locker = await vault.lockers(b);
      expect(ethers.utils.formatEther(locker.totalBalance)).to.be.equal(
        "200.0"
      );
      expect(locker.playersCount).to.be.equal(2);
      const balance = await usdt.balanceOf(vault.address);
      expect(ethers.utils.formatEther(balance)).to.be.equal("200.0");
    });

    it("Should set winner", async function () {
      const { vault, usdc, usdt, otherAccount } = await loadFixture(init);
      const b = ethers.utils.formatBytes32String(xid.next()).substring(0, 42);

      await expect(vault.addTokens([usdc.address, usdt.address])).not.to.be
        .reverted;

      await usdt.approve(vault.address, ethers.utils.parseEther("100000"));
      await expect(
        vault.create(b, usdt.address, ethers.utils.parseEther("100.0"))
      ).not.to.be.reverted;

      await usdt
        .connect(otherAccount)
        .approve(vault.address, ethers.utils.parseEther("100000"));
      await expect(vault.connect(otherAccount).depositLocker(b)).not.to.be
        .reverted;

      await expect(vault.closeLocker(b)).not.to.be.reverted;

      await expect(vault.setWinner(b, otherAccount.address)).not.to.be.reverted;

      const locker = await vault.lockers(b);
      expect(locker.state).to.be.equal(2);
      expect(locker.winner).to.be.equal(otherAccount.address);
      const fee = await vault.calculateFee(locker.totalBalance);

      const winnerBalance = await vault.balances(
        otherAccount.address,
        locker.token
      );

      const feeBalance = await vault.balancesFee(locker.token);
      expect(Number(locker.totalBalance - fee)).to.be.equal(
        Number(winnerBalance)
      );
      expect(Number(feeBalance)).to.be.equal(Number(fee));
    });
  });

  describe("Withdrawal", function () {
    it("Should cannot withdraw", async function () {
      const { vault, usdt, owner, otherAccount } = await loadFixture(init);
      await expect(
        vault.withdraw(
          owner.address,
          usdt.address,
          ethers.utils.parseEther("100.0")
        )
      ).to.be.revertedWith("Withdrawal: Not Enough Balance");
    });

    it("Should can withdraw", async function () {
      const { vault, owner, usdc, usdt, otherAccount } = await loadFixture(
        init
      );
      const b = ethers.utils.formatBytes32String(xid.next()).substring(0, 42);

      await expect(vault.addTokens([usdc.address, usdt.address])).not.to.be
        .reverted;

      await usdt.approve(vault.address, ethers.utils.parseEther("100000"));
      await expect(
        vault.create(b, usdt.address, ethers.utils.parseEther("100.0"))
      ).not.to.be.reverted;

      await usdt
        .connect(otherAccount)
        .approve(vault.address, ethers.utils.parseEther("100000"));
      await expect(vault.connect(otherAccount).depositLocker(b)).not.to.be
        .reverted;

      await expect(vault.closeLocker(b)).not.to.be.reverted;

      await expect(vault.setWinner(b, otherAccount.address)).not.to.be.reverted;
      await expect(vault.setWinner(b, otherAccount.address)).to.be.reverted;

      const winnerBefore = await usdt.balanceOf(otherAccount.address);

      const balanceFee = await vault.balancesFee(usdt.address);

      await expect(
        vault
          .connect(otherAccount)
          .withdraw(
            otherAccount.address,
            usdt.address,
            ethers.utils.parseEther("190.0")
          )
      ).not.to.be.reverted;
      const winnerAfter = await usdt.balanceOf(otherAccount.address);
      expect(winnerAfter).to.be.equal(
        ethers.utils.parseEther("190.0").add(winnerBefore)
      );

      await expect(
        vault
          .connect(otherAccount)
          .withdrawFee(otherAccount.address, usdt.address, balanceFee)
      ).to.be.reverted;

      await expect(vault.withdrawFee(owner.address, usdt.address, balanceFee))
        .not.to.be.reverted;
    });

    it("Should can withdrawLocker", async function () {
      const { vault, owner, usdc, usdt, otherAccount } = await loadFixture(
        init
      );
      const b = ethers.utils.formatBytes32String(xid.next()).substring(0, 42);

      await expect(vault.addTokens([usdc.address, usdt.address])).not.to.be
        .reverted;

      await usdt.approve(vault.address, ethers.utils.parseEther("100000"));
      await expect(
        vault.create(b, usdt.address, ethers.utils.parseEther("100.0"))
      ).not.to.be.reverted;

      await usdt
        .connect(otherAccount)
        .approve(vault.address, ethers.utils.parseEther("100000"));
      await expect(vault.connect(otherAccount).depositLocker(b)).not.to.be
        .reverted;

      // await expect(vault.closeLocker(b)).not.to.be.reverted;

      await expect(
        vault.connect(otherAccount).withdrawLocker(b, otherAccount.address)
      ).not.to.be.reverted;
    });
  });

  //   describe("Withdrawals", function () {
  //     describe("Validations", function () {
  //       it("Should revert with the right error if called too soon", async function () {
  //         const { lock } = await loadFixture(deployOneYearLockFixture);
  //
  //         await expect(lock.withdraw()).to.be.revertedWith(
  //           "You can't withdraw yet"
  //         );
  //       });
  //
  //       it("Should revert with the right error if called from another account", async function () {
  //         const { lock, unlockTime, otherAccount } = await loadFixture(
  //           deployOneYearLockFixture
  //         );
  //
  //         // We can increase the time in Hardhat Network
  //         await time.increaseTo(unlockTime);
  //
  //         // We use lock.connect() to send a transaction from another account
  //         await expect(lock.connect(otherAccount).withdraw()).to.be.revertedWith(
  //           "You aren't the owner"
  //         );
  //       });
  //
  //       it("Shouldn't fail if the unlockTime has arrived and the owner calls it", async function () {
  //         const { lock, unlockTime } = await loadFixture(
  //           deployOneYearLockFixture
  //         );
  //
  //         // Transactions are sent using the first signer by default
  //         await time.increaseTo(unlockTime);
  //
  //         await expect(lock.withdraw()).not.to.be.reverted;
  //       });
  //     });
  //
  //     describe("Events", function () {
  //       it("Should emit an event on withdrawals", async function () {
  //         const { lock, unlockTime, lockedAmount } = await loadFixture(
  //           deployOneYearLockFixture
  //         );
  //
  //         await time.increaseTo(unlockTime);
  //
  //         await expect(lock.withdraw())
  //           .to.emit(lock, "Withdrawal")
  //           .withArgs(lockedAmount, anyValue); // We accept any value as `when` arg
  //       });
  //     });
  //
  //     describe("Transfers", function () {
  //       it("Should transfer the funds to the owner", async function () {
  //         const { lock, unlockTime, lockedAmount, owner } = await loadFixture(
  //           deployOneYearLockFixture
  //         );
  //
  //         await time.increaseTo(unlockTime);
  //
  //         await expect(lock.withdraw()).to.changeEtherBalances(
  //           [owner, lock],
  //           [lockedAmount, -lockedAmount]
  //         );
  //       });
  //     });
  //   });
});
